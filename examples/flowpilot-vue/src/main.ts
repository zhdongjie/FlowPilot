// main.ts
import { createApp } from 'vue'
import App from './App.vue'
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'

import {
    createFlowPilot,
    AxiosAdapter,
    FlowDevTools,
    FlowDevToolsPanel
} from 'flowpilot'
import { onboardingSteps } from './guide.config'

// ---------------- Mock ----------------
const mock = new MockAdapter(axios, { delayResponse: 800 });
mock.onPost('/api/login').reply(200, { code: 'login_success' });
mock.onPost('/api/submit').reply(200, { code: 'submit_success' });

// ---------------- SDK Factory ----------------
function initFlowPilot() {
    // 🌟 1. 启动你的“全能大管家”
    const guide = createFlowPilot({
        steps: onboardingSteps,
        rootStepId: "step_login",
        config: {
            adapters: [
                new AxiosAdapter(axios, (res) => {
                    if (res.data.message === 'success') return `${res.config.url?.replace('/api/', '')}_success`;
                    if (res.status === 200 && res.data?.code) return res.data.code;
                    return null;
                })
            ],
            theme: { primaryColor: '#007aff', maskColor: 'rgba(0,0,0,0.65)', borderRadius: '8px', textColor: '#333', zIndex: 9999 },
            ui: { defaultPosition: 'bottom', defaultNextLabel: '好的，下一步' },
            runtime: {
                pollingInterval: 50, autoStart: true, attributeName: 'data-fp',
                signalPrefix: { click: 'click_', focus: 'focus_', blur: 'blur_', input: 'input_' },
                persistence: { enabled: true, key: 'flowpilot_onboarding_v1' }
            },
            hooks: {
                onStepStart: (stepId:string) => console.log(`[业务侧] 用户到达了节点: ${stepId}`),
                onStepComplete: (stepId:string) => console.log(`[业务侧] 用户完成了节点: ${stepId}`),
                onFlowComplete: () => console.log(`[业务侧] 恭喜！整个剧本通关！`)
            },
            debug: true
        }
    });

    // 🚀 2. 启动引擎，你的 Collector 和 Orchestrator 会在这里跑起来，气泡复活！
    guide.start();

    // 🌟 3. 挂载神级 DevTools，连接到 guide.runtime 大脑
    if (guide.config?.debug) {
        const devtools = new FlowDevTools();
        // DevTools 只像寄生虫一样连上大脑，完全不影响你原来写的 Orchestrator
        devtools.connect(guide.runtime);

        const panel = new FlowDevToolsPanel({ devtools, runtime: guide.runtime });
        panel.mount();
    }

    return guide;
}

// ---------------- App ----------------
const app = createApp(App)

const guide = initFlowPilot()

// 把你的 guide 整体注入，如果 App.vue 想调用重置，可以直接用 guide.runtime.clearCache()
app.provide('flowGuide', guide)
app.provide('flowRuntime', guide.runtime)

app.mount('#app')
