// src/sdk/plugins/merge.ts

import type { FlowPlugin } from "../types";

/**
 * 🎯 规则：
 * - preset 在前（默认能力）
 * - user 在后（优先级最高）
 * - 同 name：user 覆盖 preset
 */
export function mergePlugins(
    presetPlugins: FlowPlugin[],
    userPlugins: FlowPlugin[] = []
): FlowPlugin[] {

    const map = new Map<string, FlowPlugin>();

    // 1. preset 先放
    for (const p of presetPlugins) {
        if (p?.name) {
            map.set(p.name, p);
        }
    }

    // 2. user 覆盖 preset
    for (const p of userPlugins) {
        if (!p?.name) continue;
        map.set(p.name, p);
    }

    return Array.from(map.values());
}
