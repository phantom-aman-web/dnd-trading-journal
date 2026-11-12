"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes fresh
            gcTime: 30 * 60 * 1000, // 30 minutes cache retention
            refetchOnMount: false, // Don't refetch if data is in cache
            refetchOnWindowFocus: false, // Prevent laggy refetches on tab switch
            refetchOnReconnect: false,
            retry: 1,
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
