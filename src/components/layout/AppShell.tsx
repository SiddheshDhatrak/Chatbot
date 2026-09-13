import type { ReactNode } from "react";
import { AnimatePresence } from "framer-motion";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="h-[100dvh] flex overflow-hidden">
      <AnimatePresence>
        <Sidebar key="sidebar" />
      </AnimatePresence>
      <div className="flex-1 min-w-0 flex flex-col relative">{children}</div>
    </div>
  );
}
