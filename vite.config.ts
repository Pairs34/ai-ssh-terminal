import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron";
import renderer from "vite-plugin-electron-renderer";
import path from "node:path";

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: "electron/main/index.ts",
        vite: {
          resolve: {
            alias: {
              "@database": path.resolve(__dirname, "database")
            }
          },
          build: {
            outDir: "dist-electron/main",
            rollupOptions: {
              // pdf-parse selects its bundled pdf.js implementation with a
              // runtime require. Keep the package external so that Node can
              // resolve that implementation from node_modules in both dev and
              // packaged Electron builds.
              external: ["better-sqlite3", "ssh2", "electron", /^pdf-parse(?:\/.*)?$/]
            }
          }
        }
      },
      {
        entry: "electron/preload/index.ts",
        vite: {
          resolve: {
            alias: {
              "@database": path.resolve(__dirname, "database")
            }
          },
          build: {
            outDir: "dist-electron/preload"
          }
        }
      }
    ]),
    renderer()
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@database": path.resolve(__dirname, "database")
    }
  }
});
