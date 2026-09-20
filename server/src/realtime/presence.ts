/**
 * Tracks open sockets per user so multi-tab users count once and `lastSeenAt`
 * is written only when a user's LAST connection closes.
 * In-memory by design (single instance) — see README "Known limitations".
 */
const connections = new Map<number, number>();
/**
 * When each user last went fully offline, recorded synchronously. The DB write
 * of `lastSeenAt` is async, so a fast page reload could otherwise open the new
 * socket before that write lands and replay events the user already saw.
 */
const wentOfflineAt = new Map<number, Date>();

export const presence = {
  /** @returns true if this is the user's first open connection */
  connect(userId: number): boolean {
    const n = (connections.get(userId) ?? 0) + 1;
    connections.set(userId, n);
    return n === 1;
  },
  /** @returns true if the user just went fully offline */
  disconnect(userId: number): boolean {
    const n = (connections.get(userId) ?? 1) - 1;
    if (n <= 0) {
      connections.delete(userId);
      wentOfflineAt.set(userId, new Date());
      return true;
    }
    connections.set(userId, n);
    return false;
  },
  /**
   * The moment from which a connecting socket should be caught up.
   * `null` → the user already has a live tab, so they missed nothing.
   */
  catchUpSince(userId: number, dbLastSeenAt: Date | null): Date | null {
    if (connections.has(userId)) return null;
    const mem = wentOfflineAt.get(userId);
    if (!dbLastSeenAt) return mem ?? null;
    return mem && mem > dbLastSeenAt ? mem : dbLastSeenAt;
  },
  onlineCount(): number {
    return connections.size;
  },
  isOnline(userId: number): boolean {
    return connections.has(userId);
  },
};
