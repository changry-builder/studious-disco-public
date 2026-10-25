/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development the web app proxies API calls to the Python backend,
// so the browser (and a phone on the same Wi-Fi) only talks to one address.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:8000",
      "/health": "http://localhost:8000",
    },
  },
  test: { environment: "jsdom", globals: true },
});
