import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/smogon-stats": {
        target: "https://www.smogon.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/smogon-stats/, "/stats"),
      },
    },
  },
});
