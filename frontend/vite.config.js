import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The FastAPI backend runs on :8000; proxy /api there in dev so the frontend
// can call the same-origin paths used in src/api.js.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
    },
  },
});
