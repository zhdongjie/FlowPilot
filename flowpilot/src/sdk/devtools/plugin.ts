// src/sdk/devtools/plugin.ts

import type { FlowPlugin } from "../types";
import { FlowDevTools } from "./controller";
import { FlowDevToolsPanel } from "./viewer/panel";

export function DevToolsPlugin(): FlowPlugin {
    let devtools: FlowDevTools | null = null;
    let panel: FlowDevToolsPanel | null = null;

    return {
        name: "fp-devtools",
        setup(ctx) {
            devtools = new FlowDevTools();
            devtools.connect(ctx.runtime);

            panel = new FlowDevToolsPanel({
                devtools,
                runtime: ctx.runtime
            });

            panel.mount();
        },
        onDispose() {
            panel?.unmount();
            panel = null;

            devtools?.disconnect();
            devtools = null;
        }
    };
}
