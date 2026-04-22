// src/sdk/plugins/presets.ts

import type { FlowPlugin } from "../types";
import { DOMPlugin } from "./dom";
import { LoggerPlugin } from "./logger";
import { DevToolsPlugin } from "../devtools/plugin";

export const PluginPresets = {
    WEB_DEFAULT: "web-default",
    TRACKING_ONLY: "tracking-only",
    HEADLESS: "headless"
} as const;

export type PluginPreset =
    typeof PluginPresets[keyof typeof PluginPresets];

/**
 * 🚀 语义化 preset（工业级标准）
 */
export function resolvePresetPlugins(
    preset?: PluginPreset
): FlowPlugin[] {
    switch (preset) {

        case PluginPresets.WEB_DEFAULT:
            return [
                DOMPlugin(),
                LoggerPlugin({ prefix: "FlowPilot" }),
                DevToolsPlugin()
            ];

        case PluginPresets.TRACKING_ONLY:
            return [
                DOMPlugin()
            ];

        case PluginPresets.HEADLESS:
        default:
            return [];
    }
}
