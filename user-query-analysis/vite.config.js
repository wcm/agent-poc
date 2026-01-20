import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/user-query-analysis/",
  plugins: [react()],
  server: {
    proxy: {
      "/user-query-analysis/api": "http://localhost:3002",
    },
  },
});
