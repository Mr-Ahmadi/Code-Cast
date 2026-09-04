import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    proxy: {
      "/user": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      "/index": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      "/health": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      "/terminal": {
        target: "ws://localhost:4000",
        ws: true,
      },
    },
  },
  build: {
    outDir: "dist",
    // Split the big, rarely-changing libraries out of the app chunk so they
    // download in parallel and stay cached across app releases.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          xterm: ["@xterm/xterm", "@xterm/addon-fit"],
          markdown: ["marked"],
          diff: ["diff"],
        },
      },
    },
  },
});
