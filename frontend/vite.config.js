import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
  optimizeDeps: {
    include: ["three", "react-globe.gl", "globe.gl", "country-state-city"],
  },
  build: {
    outDir: "../backend/static",
    emptyOutDir: true,
  },
});
