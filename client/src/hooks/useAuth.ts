import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { authHeaders } from "@/lib/authHeaders";

export function useAuth() {
  const query = useQuery<User | null>({
    queryKey: ['/api/auth/user'],
    retry: false,
    // Cache session to avoid repeated calls across renders/mounts.
    // Login/logout already invalidates this queryKey.
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    queryFn: async () => {
      const res = await fetch('/api/auth/user', {
        credentials: 'include',
        headers: { ...authHeaders() },
      });
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