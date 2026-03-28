import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { router } from "@/router";
import { Toaster } from "@/components/ui/sonner";
import { ConfigProvider } from "@/contexts/config-context";
import { SplashScreen } from "@/components/shared/splash-screen";
import { useThemeStore } from "@/stores/theme-store";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000, retry: 1 },
  },
});

function AppContent() {
  const { mode } = useThemeStore();

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider>
        <Suspense
          fallback={
            <div className="flex h-screen items-center justify-center">
              Loading...
            </div>
          }
        >
          <RouterProvider router={router} />
        </Suspense>
      </ConfigProvider>
      <Toaster
        position="top-right"
        theme={mode === "dark" ? "dark" : "light"}
        toastOptions={{
          style: {
            "--normal-bg": "var(--popover)",
            "--normal-text": "var(--popover-foreground)",
            "--normal-border": "var(--border)",
          } as React.CSSProperties,
        }}
      />
    </QueryClientProvider>
  );
}

export default function App() {
  return (
    <>
      <SplashScreen />
      <AppContent />
    </>
  );
}
