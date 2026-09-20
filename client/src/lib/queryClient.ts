import { QueryClient } from '@tanstack/react-query';
import axios from 'axios';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Freshness comes from WebSocket events, not polling / refetch-on-focus.
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: (count, err) => {
        const status = axios.isAxiosError(err) ? err.response?.status : undefined;
        if (status && status >= 400 && status < 500) return false; // 403/404 won't fix themselves
        return count < 2;
      },
    },
  },
});
