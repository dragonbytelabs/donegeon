import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig({
  plugins: [
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src/sw",
      filename: "sw.ts",
      registerType: "autoUpdate",
      injectRegister: null, // we’ll register manually
      manifest: false, // optional: you can add later
      devOptions: { enabled: true } // turn off if you don’t want SW in dev
    })
  ],

  build: {
    emptyOutDir: false,
    outDir: path.resolve(__dirname, "../../../static/js"),
    rollupOptions: {
      input: {
        board: "src/board/index.ts",
        tasks: "src/tasks.ts",
        login: "src/login.ts",
        onboarding: "src/onboarding.ts",
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]"
      }
    }
  }
});
