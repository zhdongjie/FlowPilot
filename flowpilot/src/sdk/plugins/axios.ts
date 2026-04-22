// src/sdk/plugins/axios.ts

import type { FlowPlugin, FlowPluginContext, AxiosPluginOptions } from "../types";

export function AxiosPlugin(options: AxiosPluginOptions): FlowPlugin {
    const {
        instance,
        extractor,
        name = "fp-axios-plugin"
    } = options;

    let interceptorId: number | null = null;

    return {
        name,
        priority: 10,

        setup(ctx: FlowPluginContext) {
            interceptorId = instance.interceptors.response.use(
                (res: any) => {
                    try {
                        // =========================
                        // 1. 提取业务 key
                        // =========================
                        const key =
                            extractor?.(res) ??
                            res?.data?.code;

                        // =========================
                        // 2. 发射信号
                        // =========================
                        if (key) {
                            ctx.dispatch({
                                id: `net_${ctx.now()}_${Math.random()
                                    .toString(36)
                                    .substring(2, 6)}`,
                                key: String(key).toLowerCase(),
                                timestamp: ctx.now(),
                                meta: {
                                    url: res.config?.url,
                                    method: res.config?.method
                                }
                            });
                        }
                    } catch (e) {
                        console.error("[FlowPilot] AxiosPlugin error:", e);
                    }
                    return res;
                },
                (error: any) => {
                    return Promise.reject(error);
                }
            );
        },

        onDispose() {
            if (interceptorId !== null) {
                instance.interceptors.response.eject(interceptorId);
                interceptorId = null;
            }
        }
    };
}
