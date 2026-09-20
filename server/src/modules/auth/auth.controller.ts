import type { CookieOptions, Request, Response } from 'express';
import { env } from '../../config/env';
import { currentUser } from '../../lib/http';
import { parse } from '../../lib/validate';
import { LoginBody, authService, type Session } from './auth.service';

export const REFRESH_COOKIE = 'vz_rt';

/**
 * The refresh token lives ONLY in an HttpOnly cookie scoped to /api/auth:
 * JavaScript can't read it (XSS can't exfiltrate it) and it isn't sent with
 * any other API request. The short-lived access token lives in memory only.
 */
const cookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: env.COOKIE_SAMESITE,
  path: '/api/auth',
});

function sendSession(res: Response, session: Session) {
  res.cookie(REFRESH_COOKIE, session.refreshToken, { ...cookieOptions(), expires: session.refreshExpiresAt });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ accessToken: session.accessToken, user: session.user });
}

const readCookie = (req: Request): string | undefined => {
  const value: unknown = req.cookies?.[REFRESH_COOKIE];
  return typeof value === 'string' ? value : undefined;
};

export const authController = {
  async login(req: Request, res: Response) {
    sendSession(res, await authService.login(parse(LoginBody, req.body)));
  },
  async refresh(req: Request, res: Response) {
    try {
      sendSession(res, await authService.refresh(readCookie(req)));
    } catch (err) {
      res.clearCookie(REFRESH_COOKIE, cookieOptions());
      throw err;
    }
  },
  async logout(req: Request, res: Response) {
    await authService.logout(readCookie(req));
    res.clearCookie(REFRESH_COOKIE, cookieOptions());
    res.status(204).end();
  },
  async me(req: Request, res: Response) {
    res.json({ user: currentUser(req) });
  },
};
