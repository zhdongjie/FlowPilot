// src/sdk/runtime/plugin-manager.ts

import type { FlowPlugin, FlowPluginContext } from "../types";

export class PluginManager {
    private readonly plugins: FlowPlugin[] = [];
    private ctx!: FlowPluginContext;

    register(plugins: FlowPlugin[]) {
        this.plugins.push(...plugins);
    }

    setup(ctx: FlowPluginContext) {
        this.ctx = ctx;
        // 工业级防御：一个插件报错不能搞崩整个引擎
        this.plugins.forEach(p => {
            try {
                p.setup?.(this.ctx);
            } catch (e) {
                console.error(`[FlowPilot] Plugin '${p.name}' setup failed:`, e);
            }
        });
    }

    emit<K extends keyof Omit<FlowPlugin, 'name'>>(hook: K, ...args: any[]) {
        if (!this.ctx) return;
        for (const p of this.plugins) {
            const fn = p[hook];
            if (fn) {
                try {
                    // 动态注入 ctx 作为最后一个参数
                    (fn as any)(...args, this.ctx);
                } catch (e) {
                    console.error(`[FlowPilot] Plugin '${p.name}' failed on hook '${hook}':`, e);
                }
            }
        }
    }
}
