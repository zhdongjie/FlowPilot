// src/sdk/runtime/plugin-manager.ts

import {FlowPlugin, FlowPluginContext, Signal} from "../types";

export class PluginManager {
    private readonly plugins: FlowPlugin[] = [];
    private ctx!: FlowPluginContext;

    register(plugins: FlowPlugin[]) {
        this.plugins.push(...plugins);
    }

    setup(ctx: FlowPluginContext) {
        this.ctx = ctx;

        for (const p of this.plugins) {
            try {
                p.setup?.(ctx);
            } catch (e) {
                console.error(`[FlowPilot] Plugin '${p.name}' setup failed:`, e);
            }
        }
    }

    emitSignal(signal: Signal): boolean {
        for (const p of this.plugins) {
            try {
                if (p.onSignal?.(signal, this.ctx) === false) {
                    return false;
                }
            } catch (e) {
                console.error(`[FlowPilot] Plugin '${p.name}' error:`, e);
            }
        }
        return true;
    }

    emitHook<K extends keyof FlowPlugin>(hook: K, ...args: any[]) {
        for (const p of this.plugins) {
            const fn = p[hook];
            if (!fn) continue;

            try {
                (fn as any)(...args, this.ctx);
            } catch (e) {
                console.error(`[FlowPilot] hook error:`, e);
            }
        }
    }
}
