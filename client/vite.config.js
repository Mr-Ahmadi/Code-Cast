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
      "/terminal": {
        target: "ws://localhost:4000",
        ws: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
