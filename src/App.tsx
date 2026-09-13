import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { getTheme } from "@/lib/theme";
import { useChatStore } from "@/store/useChatStore";
import { useEffect } from "react";

export default function App() {
  useEffect(() => {
    const t = getTheme();
    document.documentElement.setAttribute("data-theme", t);
    useChatStore.getState().setTheme(t);
    void useChatStore.getState().loadSessions();
  }, []);

  return (
    <div className="grain min-h-[100dvh]">
      <div className="aurora" aria-hidden />
      <RouterProvider router={router} />
    </div>
  );
}
