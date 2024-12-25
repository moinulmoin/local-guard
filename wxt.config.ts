import path from "node:path";
import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  extensionApi: "chrome",
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "LocalGuard",
    description: "Disable extensions on localhost and restore them when you leave",
    permissions: ["storage", "tabs", "management"],
  },
  runner: {
    disabled: true
  },
  vite: () => ({
    resolve: {
      alias: {
        "@": path.resolve(__dirname, ".")
      }
    }
  }),
  dev: {
    server: {
      port: 6969
    }
  }
});
