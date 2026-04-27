import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isMinify = process.env.MINIFY === "true";

export default defineConfig({
    build: {
        lib: {
            entry: path.resolve(__dirname, "src/index.ts"),
            name: "FlowPilot",
            formats: ["umd", "es"],
            fileName: (format) => {
                const suffix = isMinify ? ".min" : "";
                return format === "es"
                    ? `flowpilot.esm${suffix}.js`
                    : `flowpilot.umd${suffix}.js`;
            }
        },
        outDir: "dist",
        emptyOutDir: false,
        minify: false
    }
});
