// flowpilot/src/sdk/collector/adapters.ts
import type { NetworkAdapter, EmitFunction } from "../types";

export class AxiosAdapter implements NetworkAdapter {
    private readonly axiosInstance: any;
    private readonly extractor?: (res: any) => string | null | undefined;

    constructor(axiosInstance: any, extractor?: (res: any) => string | null | undefined) {
        this.axiosInstance = axiosInstance;
        this.extractor = extractor;
    }

    install(emit: EmitFunction) {
        this.axiosInstance.interceptors.response.use(
            (res: any) => {
                // 🌟 核心：如果有自定义提取器就用自定义的，否则兜底用 res.data.code
                let key: string | null | undefined;

                if (this.extractor) {
                    key = this.extractor(res);
                } else {
                    key = res?.data?.code;
                }

                // 如果提取到了 key，才发射信号
                if (key) {
                    emit({ key: key.toLowerCase(), meta: { url: res.config?.url } });
                }
                return res;
            },
            (error: any) => { /* 错误处理类似 */ return Promise.reject(error); }
        );
    }
}
