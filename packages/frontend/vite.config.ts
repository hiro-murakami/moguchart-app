import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vuetify, { transformAssetUrls } from "vite-plugin-vuetify";
import Unfonts from "unplugin-fonts/vite";
import Components from "unplugin-vue-components/vite";
import path from "node:path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue({
      template: {
        transformAssetUrls,
        compilerOptions: {
          isCustomElement: (tag) => tag.startsWith("gantt-"),
        },
      },
    }),
    // https://github.com/vuetifyjs/vuetify-loader/tree/next/packages/vite-plugin
    vuetify({
      autoImport: true,
    }),
    Components(),
    Unfonts({
      google: {
        families: [
          {
            name: "Roboto",
            styles: "100;300;400;500;700;900",
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // 以下を追加: functionsへのエイリアス
      "@functions/types": path.resolve(__dirname, "../functions/src/types"),
    },
    extensions: [".js", ".json", ".jsx", ".mjs", ".ts", ".tsx", ".vue"],
  },
  optimizeDeps: {
    // リンクされたパッケージを事前バンドルから除外する（これで dedupe が効くようになります）
    exclude: ["@mogura/moguchart"],
  },
  server: {
    proxy: {
      "/api": {
        // firebase-debug.log に出力されているエミュレータのURLを指定
        target:
          "http://127.0.0.1:5001/firestore-sample-c7300/asia-northeast1/api",
        changeOrigin: true,
      },
    },
    fs: {
      // リンクされたパッケージがモノレポ外にある場合のために許可範囲を広げる
      allow: ["..", "../../../"],
    },
  },
});
