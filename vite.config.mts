import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

const rootDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(rootDirectory, "./src"),
    },
  },
  server: {
    port: 3000,
    open: false,
    proxy: {
      // Backend (Next API routes + Prisma) runs via `npm run next-dev` on :3001
      "/api": "http://localhost:3001",
    },
  },
  preview: {
    port: 3000,
  },
});