import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        board: "src/board/index.ts",
        builder: "src/builder/index.ts"
      },
      output: {
        entryFileNames: "js/[name].js",
        chunkFileNames: "js/chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]"
      }
    }
  }
});
