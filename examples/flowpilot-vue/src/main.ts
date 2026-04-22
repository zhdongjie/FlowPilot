// main.ts
import { createApp } from 'vue'
import App from './App.vue'
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'

import {
    createFlowPilot,
    AxiosAdapter,
    DevToolsPlugin,
    LoggerPlugin
} from 'flowpilot'
import { onboardingSteps } from './guide.config'

// ---------------- Mock ----------------
const mock = new MockAdapter(axios, { delayResponse: 800 });
mock.onPost('/api/login').reply(200, { code: 'login_success' });
mock.onPost('/api/submit').reply(200, { code: 'submit_success' });

// ---------------- SDK Factory ----------------
function initFlowPilot() {
    // 🌟 2. 启动全能大管家，以极其优雅的方式组合能力
    const guide = createFlowPilot({
        steps: onboardingSteps,
        rootStepId: "step_login",

        // 🌟 3. 【核心进化】能力组合层：想要什么功能，就插什么插件！
        plugins: [
            LoggerPlugin(), // 自动在控制台打印信号与状态变更
            DevToolsPlugin() // 开启神级可视化控制台
        ],

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

    // 🚀 4. 启动引擎！所有的插件会收到 onStart 钩子自动激活
    guide.start();

    return guide;
}

// ---------------- App ----------------
const app = createApp(App)

const guide = initFlowPilot()

// 把你的 guide 整体注入
app.provide('flowGuide', guide)
app.provide('flowRuntime', guide.runtime)

app.mount('#app')
