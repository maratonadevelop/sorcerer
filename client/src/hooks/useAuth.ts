import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { authHeaders } from "@/lib/authHeaders";

export function useAuth() {
  const query = useQuery<User | null>({
    queryKey: ['/api/auth/user'],
    retry: false,
    // Do not cache; always ask the server
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    queryFn: async () => {
      const url = `/api/auth/user?_=${Date.now()}`;
      const res = await fetch(url, {
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-store', ...authHeaders() },
      });
      // Some environments may still respond 304; treat it as no change and retry once with a different nonce
      if (res.status === 304) {
        const res2 = await fetch(`/api/auth/user?_=${Date.now() + 1}`,
          {
            credentials: 'include',
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-store', ...authHeaders() },
          },
        );
        if (!res2.ok) return null;
        return res2.json();
      }
      if (!res.ok) return null;
      return res.json();
    },
  });

  const user = query.data ?? null;
  const isLoading = query.isLoading;

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: user?.isAdmin || false,
  };
}