import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/products": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
      "/access": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
      "/sales": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
    },
  },
});
