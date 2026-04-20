// src/sdk/vue/plugin.ts

import type { App } from "vue";
import { BehaviorCollector } from "../collector/collector";

export interface FlowGuideOptions {
    runtime: any;
    router?: any;
    axios?: any;
}

export const FlowGuidePlugin = {
    install(app: App, options: FlowGuideOptions) {
        const collector = new BehaviorCollector(options.runtime);

        // 挂到全局（仅内部用）
        app.config.globalProperties.$collector = collector;

        // 注册各类采集器
        setupDOMCollector(collector);
        setupRouterCollector(collector, options.router);
        setupAxiosCollector(collector, options.axios);
    }
};

function setupDOMCollector(collector: BehaviorCollector) {
    document.addEventListener("click", (e) => {
        let el = e.target as HTMLElement;

        while (el) {
            const key = el.dataset.fp;
            if (key) {
                collector.emit(key);
                return;
            }
            el = el.parentElement!;
        }
    });
}

function setupRouterCollector(collector: BehaviorCollector, router: any) {
    if (!router) return;

    router.afterEach((to: any) => {
        collector.emit(`page_${to.name || to.path}`);
    });
}

function setupAxiosCollector(collector: BehaviorCollector, axios: any) {
    if (!axios) return;

    axios.interceptors.response.use((res: any) => {
        const code = res?.data?.code;

        if (code) {
            collector.emit(code.toLowerCase());
        }

        return res;
    });
}
