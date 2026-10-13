import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Pre-bundle the lazily imported Firebase SDK at startup: discovering it on the
  // first click makes dev Vite re-optimize mid-sign-in and the popup gets blocked.
  optimizeDeps: { include: ["firebase/app", "firebase/auth"] },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
