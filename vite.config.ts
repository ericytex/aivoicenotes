import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "robots.txt", "icon.svg"],
      manifest: {
        name: "VoiceNote AI - Transform Voice into Action",
        short_name: "VoiceNote AI",
        description: "AI-powered voice transcription app. Record meetings, capture ideas, and convert voice notes into blogs, emails, and to-do lists instantly.",
        theme_color: "#000000",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "any",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
          {
            src: "/favicon.ico",
            sizes: "64x64 32x32 24x24 16x16",
            type: "image/x-icon",
          },
        ],
        shortcuts: [
          {
            name: "New Recording",
            short_name: "Record",
            description: "Start a new voice recording",
            url: "/recorder",
            icons: [{ src: "/icon-192.png", sizes: "96x96", type: "image/png" }],
          },
          {
            name: "My Notes",
            short_name: "Notes",
            description: "View your saved notes",
            url: "/notes",
            icons: [{ src: "/icon-192.png", sizes: "96x96", type: "image/png" }],
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/sql\.js\.org\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "sqljs-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
          {
            urlPattern: /^https:\/\/api\.groq\.com\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "groq-api-cache",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60, // 1 hour
              },
            },
          },
          {
            urlPattern: /^https:\/\/generativelanguage\.googleapis\.com\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "gemini-api-cache",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60, // 1 hour
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: mode === "development",
        type: "module",
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
