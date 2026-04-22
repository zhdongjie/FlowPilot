// src/sdk/devtools/plugin.ts
import type { FlowPlugin } from "../types";
import { FlowDevTools } from "./controller";
import { FlowDevToolsPanel } from "./viewer/panel";

export function DevToolsPlugin(): FlowPlugin {
    return {
        name: "fp-devtools",
        setup(ctx) {
            const devtools = new FlowDevTools();
            devtools.connect(ctx.runtime);

            const panel = new FlowDevToolsPanel({
                devtools,
                runtime: ctx.runtime
            });

            panel.mount();
        }
    };
}
