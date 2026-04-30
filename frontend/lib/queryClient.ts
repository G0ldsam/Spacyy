import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is fresh for 5 minutes — no refetch during this time
      staleTime: 5 * 60 * 1000,
      // Keep unused data in cache for 10 minutes
      cacheTime: 10 * 60 * 1000,
      // Don't refetch on window focus (mobile app behavior)
      refetchOnWindowFocus: false,
      // Retry failed requests once
      retry: 1,
      // Show cached data while fetching fresh data
      refetchOnMount: 'always',
    },
    mutations: {
      // Retry mutations once on network error
      retry: 1,
    },
  },
})
