// src/sdk/plugins/axios.ts

import type { FlowPlugin, FlowPluginContext } from "../types";

export function AxiosPlugin(
    axiosInstance: any,
    extractor?: (res: any) => string | null | undefined
): FlowPlugin {

    // 闭包变量：保存拦截器的 ID，用于引擎销毁时解绑
    let interceptorId: number | null = null;

    return {
        name: "fp-axios-plugin",

        // 🌟 插件挂载时（相当于以前的 install）
        setup(ctx: FlowPluginContext) {
            interceptorId = axiosInstance.interceptors.response.use(
                (res: any) => {
                    try {
                        // 1. 完美保留你原有的提取逻辑
                        let key: string | null | undefined;

                        if (extractor) {
                            key = extractor(res);
                        } else {
                            key = res?.data?.code;
                        }

                        // 2. 如果提取到了 key，通过大管家 Context 发射信号
                        if (key) {
                            ctx.dispatch({
                                id: `net_${ctx.now()}_${Math.random().toString(36).substring(2, 6)}`,
                                key: key.toLowerCase(),
                                timestamp: ctx.now(),
                                payload: { url: res.config?.url }
                            });
                        }
                    } catch (e) {
                        console.error("[FlowPilot] AxiosPlugin parse error:", e);
                    }
                    return res;
                },
                (error: any) => {
                    return Promise.reject(error);
                }
            );
        },

        // 引擎停止时
        onStop() {
            if (interceptorId !== null) {
                axiosInstance.interceptors.response.eject(interceptorId);
                interceptorId = null;
            }
        }
    };
}
