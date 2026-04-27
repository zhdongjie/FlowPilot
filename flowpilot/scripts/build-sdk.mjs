import { execFileSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const args = process.argv.slice(2);
const isMinify = process.env.MINIFY === "true" || args.includes("--minify");
const env = {
    ...process.env,
    MINIFY: isMinify ? "true" : "false"
};

await main();

async function main() {
    runNode(path.resolve(rootDir, "node_modules/vite/bin/vite.js"), ["build"], env);

    if (isMinify) {
        await minifyBundle(path.resolve(rootDir, "dist", "flowpilot.esm.min.js"));
        await minifyBundle(path.resolve(rootDir, "dist", "flowpilot.umd.min.js"));
    }

    rmSync(path.resolve(rootDir, "dist", "sdk", "__tests__"), {
        recursive: true,
        force: true
    });

    runNode(
        path.resolve(rootDir, "node_modules/typescript/bin/tsc"),
        [
            "-p",
            path.resolve(rootDir, "tsconfig.build.json")
        ],
        env
    );
}

function runNode(entryFile, entryArgs, entryEnv) {
    execFileSync(process.execPath, [entryFile, ...entryArgs], {
        cwd: rootDir,
        stdio: "inherit",
        env: entryEnv
    });
}
async function minifyBundle(filePath) {
    let terser;

    try {
        terser = await import("terser");
    } catch {
        throw new Error("MINIFY=true requires the `terser` package to be installed.");
    }

    const source = readFileSync(filePath, "utf8");
    const result = await terser.minify(source, {
        compress: true,
        mangle: true
    });

    if (!result.code) {
        throw new Error(`Failed to minify bundle: ${filePath}`);
    }

    writeFileSync(filePath, result.code, "utf8");
}
