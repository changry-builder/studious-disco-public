/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// base "./" so the build works from any path on a static host (it is served under /who-done-it/).
export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      // "prompt": a new version waits until the player accepts it on the Home screen.
      registerType: "prompt",
      injectRegister: false, // registered by hand in src/main.tsx
      includeAssets: ["icons/*.png", "icons/*.svg"],
      workbox: { globPatterns: ["**/*.{js,css,html,png,svg,webmanifest}"] },
      manifest: {
        name: "Who Done It?",
        short_name: "Who Done It?",
        description: "A murder mystery for one phone.",
        start_url: "./",
        scope: "./",
        display: "standalone",
        orientation: "portrait",
        background_color: "#17130f",
        theme_color: "#1c1814",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  test: {
    globals: true,
    environment: "node",
    environmentMatchGlobs: [["tests/app/**", "jsdom"]],
    testTimeout: 120000,
  },
});
