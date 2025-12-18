import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { withRevisionParam } from "./revision";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = data ? { "Content-Type": "application/json" } : {};
  try {
    if (import.meta.env.DEV) {
      const tok = typeof window !== 'undefined' ? localStorage.getItem('devToken') : null;
      if (tok) headers['Authorization'] = `Bearer ${tok}`;
    }
  } catch {}
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const headers: Record<string, string> = {};
    try {
      if (import.meta.env.DEV) {
        const tok = typeof window !== 'undefined' ? localStorage.getItem('devToken') : null;
        if (tok) headers['Authorization'] = `Bearer ${tok}`;
      }
    } catch {}
    const url = withRevisionParam(queryKey.join("/") as string);
    const res = await fetch(url, {
      credentials: "include",
      headers,
      // Ensure we bypass any short-term HTTP caches so admin edits reflect immediately
      cache: 'no-store',
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      // Keep data until explicit invalidation, but when we do refetch, bypass HTTP cache via getQueryFn
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
