import { QueryClient } from '@tanstack/react-query'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,      // 5 minutos sem refetch
      gcTime: 1000 * 60 * 60 * 24,   // 24h no cache
      refetchOnWindowFocus: false,   // não recarrega ao trocar aba
      refetchOnReconnect: false,     // não recarrega ao reconectar
      retry: 2,                      // tenta 2x se falhar
    },
  },
})

export const persister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
})