import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sdkEntry = path.resolve(
    __dirname,
    "../../flowpilot",
    "dist",
    "flowpilot.esm.js"
);

export default defineConfig({
    plugins: [vue()],
    resolve: {
        alias: {
            flowpilot: sdkEntry
        }
    },
    server: {
        port: 8080,
        strictPort: false
    }
});
