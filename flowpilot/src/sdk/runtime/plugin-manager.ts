// src/sdk/runtime/plugin-manager.ts

import type { Signal, FlowPlugin, FlowPluginContext } from "../types";

export class PluginManager {
    private readonly plugins: FlowPlugin[] = [];
    private ctx!: FlowPluginContext;

    // Event Bus
    private readonly eventBus = new Map<string, Array<(payload: any) => void>>();

    /**
     * 注册插件
     */
    register(plugins: FlowPlugin[]) {
        const map = new Map<string, FlowPlugin>();

        // 1. 先放已有插件
        for (const p of this.plugins) {
            if (p?.name) {
                map.set(p.name, p);
            }
        }

        // 2. 新插件覆盖旧插件
        for (const p of plugins) {
            if (!p?.name) continue;
            map.set(p.name, p);
        }

        this.plugins.length = 0;
        this.plugins.push(...map.values());
    }

    /**
     * 初始化插件上下文
     */
    setup(ctx: FlowPluginContext) {
        this.ctx = ctx;

        for (const p of this.plugins) {
            try {
                p.setup?.(this.ctx);
            } catch (e) {
                console.error(`[FlowPilot] Plugin '${p.name}' setup failed:`, e);
            }
        }
    }

    // =========================
    // 🛡 Signal Middleware
    // =========================

    emitSignal(signal: Signal): boolean {
        if (!this.ctx) return true;

        for (const p of this.plugins) {
            if (!p.onSignal) continue;

            try {
                const result = p.onSignal(signal, this.ctx);
                if (result === false) return false;
            } catch (e) {
                console.error(`[FlowPilot] Plugin '${p.name}' onSignal failed:`, e);
                this.triggerError(e as Error);
            }
        }

        return true;
    }

    // =========================
    // 🔄 Hook Dispatcher
    // =========================

    emitHook<K extends keyof Omit<FlowPlugin, 'name' | 'onSignal' | 'setup' | 'onError'>>(
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
    // ❌ Error Handling
    // =========================

    private triggerError(error: Error) {
        if (!this.ctx) return;

        for (const p of this.plugins) {
            try {
                p.onError?.(error, this.ctx);
            } catch {
                // ignore
            }
        }
    }

    // =========================
    // 📡 Event Bus
    // =========================

    emitEvent(event: string, payload?: any) {
        const listeners = this.eventBus.get(event);
        listeners?.forEach(cb => {
            try {
                cb(payload);
            } catch (e) {
                console.error(`[FlowPilot] EventBus error on '${event}':`, e);
            }
        });
    }

    onEvent(event: string, callback: (payload: any) => void): () => void {
        if (!this.eventBus.has(event)) {
            this.eventBus.set(event, []);
        }

        this.eventBus.get(event)!.push(callback);

        return () => {
            const arr = this.eventBus.get(event);
            if (!arr) return;

            const idx = arr.indexOf(callback);
            if (idx > -1) arr.splice(idx, 1);
        };
    }
}
