// src/sdk/runtime/plugin-manager.ts

import type { Signal, FlowPlugin, FlowPluginContext } from "../types";

export class PluginManager {
    private readonly plugins: FlowPlugin[] = [];
    private ctx!: FlowPluginContext;

    // 🌟 插件间的通信总线 (Event Bus)
    private readonly eventBus = new Map<string, Array<(payload: any) => void>>();

    /**
     * 注册插件
     */
    register(plugins: FlowPlugin[]) {
        this.plugins.push(...plugins);
    }

    /**
     * 初始化所有插件的上下文
     */
    setup(ctx: FlowPluginContext) {
        this.ctx = ctx;

        // 工业级防御：一个插件的 setup 报错不能搞崩整个引擎
        this.plugins.forEach(p => {
            try {
                p.setup?.(this.ctx);
            } catch (e) {
                console.error(`[FlowPilot] Plugin '${p.name}' setup failed:`, e);
            }
        });
    }

    // ==========================================
    // 🛡️ 拦截器机制 (Middleware Pattern)
    // ==========================================

    /**
     * 发射信号给所有插件。如果任何一个插件返回 false，则拦截该信号。
     * @returns boolean 是否允许放行信号
     */
    emitSignal(signal: Signal): boolean {
        if (!this.ctx) return true;

        for (const p of this.plugins) {
            if (p.onSignal) {
                try {
                    const result = p.onSignal(signal, this.ctx);
                    // 🌟 核心：明确返回 false 时，直接熔断，拒绝信号进入 Engine！
                    if (result === false) {
                        return false;
                    }
                } catch (e) {
                    console.error(`[FlowPilot] Plugin '${p.name}' failed on onSignal:`, e);
                    this.triggerError(e as Error);
                }
            }
        }
        return true; // 所有插件都放行，或者没有插件拦截
    }

    // ==========================================
    // 🚀 常规生命周期分发
    // ==========================================

    /**
     * 分发常规生命周期 Hook (不包含 onSignal)
     */
    emitHook<K extends keyof Omit<FlowPlugin, 'name' | 'onSignal' | 'setup' | 'onError'>>(
        hook: K,
        ...args: any[]
    ) {
        if (!this.ctx) return;

        for (const p of this.plugins) {
            const fn = p[hook];
            if (fn) {
                try {
                    // 动态注入 ctx 作为最后一个参数
                    (fn as any)(...args, this.ctx);
                } catch (e) {
                    console.error(`[FlowPilot] Plugin '${p.name}' failed on hook '${hook}':`, e);
                    this.triggerError(e as Error);
                }
            }
        }
    }

    /**
     * 专门分发异常钩子，让监控类插件捕获
     */
    private triggerError(error: Error) {
        if (!this.ctx) return;
        for (const p of this.plugins) {
            if (p.onError) {
                try {
                    p.onError(error, this.ctx);
                } catch {
                    // 如果错误捕获器本身也报错了，直接忽略，防止死循环
                }
            }
        }
    }

    // ==========================================
    // 📡 跨插件通信总线 (Event Bus)
    // ==========================================

    /**
     * 允许插件互相发送自定义事件
     */
    emitEvent(event: string, payload?: any) {
        const listeners = this.eventBus.get(event);
        if (listeners) {
            listeners.forEach(cb => {
                try {
                    cb(payload);
                } catch (e) {
                    console.error(`[FlowPilot] EventBus Error on event '${event}':`, e);
                }
            });
        }
    }

    /**
     * 允许插件监听自定义事件，返回取消订阅函数
     */
    onEvent(event: string, callback: (payload: any) => void): () => void {
        if (!this.eventBus.has(event)) {
            this.eventBus.set(event, []);
        }
        this.eventBus.get(event)!.push(callback);

        // 返回取消订阅函数 (unsubscribe)
        return () => {
            const listeners = this.eventBus.get(event);
            if (listeners) {
                const idx = listeners.indexOf(callback);
                if (idx > -1) {
                    listeners.splice(idx, 1);
                }
            }
        };
    }
}
