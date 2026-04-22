// src/sdk/runtime/plugin-manager.ts

import type {
    Signal,
    FlowPlugin,
    FlowPluginContext,
    PluginState
} from "../types";

export class PluginManager {
    private plugins: FlowPlugin[] = [];
    private ctx!: FlowPluginContext;

    // 防止 setup 重复执行
    private initialized = new WeakSet<FlowPlugin>();

    // Event Bus
    private readonly eventBus = new Map<string, Array<(payload: any) => void>>();

    // =========================
    // 注册插件（支持覆盖 + priority）
    // =========================
    register(plugins: FlowPlugin[]) {
        const map = new Map<string, FlowPlugin>();

        // 保留旧插件
        for (const p of this.plugins) {
            if (p?.name) map.set(p.name, p);
        }

        // 新插件覆盖旧插件
        for (const p of plugins) {
            if (!p?.name) continue;
            map.set(p.name, p);
        }

        this.plugins = Array.from(map.values());

        // priority 排序（越大越先执行）
        this.plugins.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    }

    // =========================
    // 初始化上下文
    // =========================
    setup(ctx: FlowPluginContext) {
        this.ctx = ctx;

        for (const p of this.plugins) {
            this.setPluginState(p, "initialized");
        }
    }

    // =========================
    // 生命周期状态机（核心）
    // =========================
    setPluginState(plugin: FlowPlugin, next: PluginState) {
        const prev = plugin.state;
        if (prev === next) return;

        switch (next) {
            case "initialized":
                if (!this.initialized.has(plugin)) {
                    plugin.setup?.(this.ctx);
                    this.initialized.add(plugin);
                }
                break;

            case "running":
                plugin.onStart?.(this.ctx);
                break;

            case "paused":
                plugin.onPause?.(this.ctx);
                break;

            case "disposed":
                plugin.onDispose?.(this.ctx);
                break;
        }

        plugin.state = next;
    }

    // =========================
    // 外部生命周期 API
    // =========================
    start() {
        for (const p of this.plugins) {
            this.setPluginState(p, "running");
        }
    }

    pause() {
        for (const p of this.plugins) {
            this.setPluginState(p, "paused");
        }
    }

    destroy() {
        for (const p of this.plugins) {
            this.setPluginState(p, "disposed");
        }

        this.plugins = [];
        this.initialized = new WeakSet();
    }

    // =========================
    // Signal middleware（拦截链）
    // =========================
    emitSignal(signal: Signal): boolean {
        if (!this.ctx) return true;

        for (const p of this.plugins) {
            if (!p.onSignal) continue;

            try {
                const result = p.onSignal(signal, this.ctx);

                // 拦截 signal
                if (result === false) return false;

            } catch (e) {
                console.error(
                    `[FlowPilot] Plugin '${p.name}' onSignal failed:`,
                    e
                );
                this.triggerError(e as Error);
            }
        }

        return true;
    }

    // =========================
    // Hook dispatch
    // =========================
    emitHook<K extends keyof Omit<
        FlowPlugin,
        "name" | "onSignal" | "setup" | "onError" | "onDispose" | "priority"
    >>(
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
                console.error(
                    `[FlowPilot] Plugin '${p.name}' hook '${hook}' failed:`,
                    e
                );
                this.triggerError(e as Error);
            }
        }
    }

    // =========================
    // Error system
    // =========================
    private triggerError(error: Error) {
        if (!this.ctx) return;

        for (const p of this.plugins) {
            try {
                p.onError?.(error, this.ctx);
            } catch {
                // ignore plugin error crash
            }
        }
    }

    // =========================
    // Event Bus
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
