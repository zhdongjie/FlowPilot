// flowpilot/src/sdk/collector/adapters.ts

// 🌟 从你统一的 types 目录引入
import type { NetworkAdapter, EmitFunction } from "../types";

export class AxiosAdapter implements NetworkAdapter {
    private readonly axiosInstance: any;

    constructor(axiosInstance: any) {
        this.axiosInstance = axiosInstance;
    }

    install(emit: EmitFunction) {
        this.axiosInstance.interceptors.response.use(
            (res: any) => {
                const code = res?.data?.code;
                if (code) emit({ key: code.toLowerCase(), meta: { url: res.config?.url } });
                return res;
            },
            (error: any) => {
                const code = error.response?.data?.code;
                if (code) emit({ key: `error_${code.toLowerCase()}` });
                return Promise.reject(error);
            }
        );
    }
}
