// src/sdk/runtime/plugin-manager.ts

import type { Signal, FlowPlugin, FlowPluginContext } from "../types";

export class PluginManager {
    private plugins: FlowPlugin[] = [];
    private ctx!: FlowPluginContext;

    private readonly eventBus = new Map<string, Array<(payload: any) => void>>();

    // =========================
    // 注册（支持 priority）
    // =========================
    register(plugins: FlowPlugin[]) {
        const map = new Map<string, FlowPlugin>();

        // 1. 合并（后者覆盖前者）
        for (const p of this.plugins) {
            if (p?.name) map.set(p.name, p);
        }

        for (const p of plugins) {
            if (!p?.name) continue;
            map.set(p.name, p);
        }

        this.plugins = Array.from(map.values());

        // 按 priority 排序（核心升级点）
        this.plugins.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    }

    // =========================
    // setup
    // =========================
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

    // =========================
    // signal middleware（链式升级）
    // =========================
    emitSignal(signal: Signal): boolean {
        if (!this.ctx) return true;

        for (const p of this.plugins) {
            if (!p.onSignal) continue;

            try {
                const result = p.onSignal(signal, this.ctx);

                // 中断链
                if (result === false) return false;

            } catch (e) {
                console.error(`[FlowPilot] Plugin '${p.name}' onSignal failed:`, e);
                this.triggerError(e as Error);
            }
        }

        return true;
    }

    // =========================
    // hook dispatch
    // =========================
    emitHook<K extends keyof Omit<FlowPlugin, 'name' | 'onSignal' | 'setup' | 'onError' | 'onDispose' | 'priority'>>(
        hook: K,
        ...args: any[]
    ) {
        if (!this.ctx) return;

        for (const p of this.plugins) {
            const fn = p[hook];
            if (!fn) continue;

            try {
                (fn as any)(...args, this.ctx);
            } catch (e) {
                console.error(`[FlowPilot] Plugin '${p.name}' hook '${hook}' failed:`, e);
                this.triggerError(e as Error);
            }
        }
    }

    // =========================
    // error
    // =========================
    private triggerError(error: Error) {
        if (!this.ctx) return;

        for (const p of this.plugins) {
            try {
                p.onError?.(error, this.ctx);
            } catch {}
        }
    }

    // =========================
    // dispose
    // =========================
    dispose() {
        for (const p of this.plugins) {
            try {
                p.onDispose?.(this.ctx);
            } catch (e) {
                console.warn(`[FlowPilot] Plugin '${p.name}' dispose failed:`, e);
            }
        }

        this.plugins = [];
    }

    // =========================
    // event bus
    // =========================
    emitEvent(event: string, payload?: any) {
        this.eventBus.get(event)?.forEach(cb => cb(payload));
    }

    onEvent(event: string, cb: (payload: any) => void) {
        if (!this.eventBus.has(event)) {
            this.eventBus.set(event, []);
        }

        this.eventBus.get(event)!.push(cb);

        return () => {
            const arr = this.eventBus.get(event);
            if (!arr) return;
            const idx = arr.indexOf(cb);
            if (idx > -1) arr.splice(idx, 1);
        };
    }
}
