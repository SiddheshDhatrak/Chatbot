import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";

const LandingPage = lazy(() => import("@/views/LandingPage"));
const ChatPage = lazy(() => import("@/views/ChatPage"));

function Fallback() {
  return (
    <div className="h-[100dvh] grid place-items-center">
      <div className="flex items-center gap-2 text-[13px] text-[var(--muted)]">
        <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
        Preparing the salon…
      </div>
    </div>
  );
}

const withSuspense = (el: React.ReactNode) => <Suspense fallback={<Fallback />}>{el}</Suspense>;

export const router = createBrowserRouter([
  { path: "/", element: withSuspense(<LandingPage />) },
  { path: "/chat", element: withSuspense(<ChatPage />) },
  { path: "/chat/:id", element: withSuspense(<ChatPage />) },
  { path: "*", element: withSuspense(<LandingPage />) },
]);
