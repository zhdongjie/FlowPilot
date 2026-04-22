// src/sdk/devtools/plugin.ts

import { FlowDevTools } from "./controller";
import { FlowDevToolsPanel } from "./viewer/panel";

export function DevToolsPlugin(runtime: any) {
    const devtools = new FlowDevTools();
    devtools.connect(runtime);

    const panel = new FlowDevToolsPanel({
        devtools,
        runtime
    });

    panel.mount();

    return devtools;
}
