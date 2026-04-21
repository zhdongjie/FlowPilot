// main.ts
import { createApp } from 'vue'
import App from './App.vue'
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'

import { GuideController, AxiosAdapter } from 'flowpilot'
import { onboardingSteps } from './guide.config'

// ---------------- Mock ----------------
const mock = new MockAdapter(axios, { delayResponse: 800 });
mock.onPost('/api/login').reply(200, { code: 'login_success' });
mock.onPost('/api/submit').reply(200, { code: 'submit_success' });

// ---------------- SDK Factory ----------------
function createFlowGuide() {
    const guide = new GuideController({
        steps: onboardingSteps,
        rootStepId: "step_login",

        config: {
            // 1. 网络插件
            adapters: [
                new AxiosAdapter(axios, (res) => {
                    if (res.data.message === 'success') {
                        return `${res.config.url?.replace('/api/', '')}_success`;
                    }
                    if (res.status === 200 && res.data?.code) {
                        return res.data.code;
                    }
                    return null;
                })
            ],

            // 2. 主题
            theme: {
                primaryColor: '#007aff',
                maskColor: 'rgba(0,0,0,0.65)',
                borderRadius: '8px',
                textColor: '#333',
                zIndex: 9999
            },

            // 3. UI
            ui: {
                defaultPosition: 'bottom',
                defaultNextLabel: '好的，下一步'
            },

            // 4. runtime
            runtime: {
                pollingInterval: 50,
                autoStart: true,

                attributeName: 'data-fp',
                signalPrefix: {
                    click: 'click_',
                    focus: 'focus_',
                    blur: 'blur_',
                    input: 'input_'
                },

                persistence: {
                    enabled: true,
                    key: 'flowpilot_onboarding_v1'
                }
            },

            // 5. hooks
            hooks: {
                onStepStart: (stepId) => {
                    console.log(`[业务侧] 用户到达了节点: ${stepId}`);
                },
                onStepComplete: (stepId) => {
                    console.log(`[业务侧] 用户完成了节点: ${stepId}`);
                },
                onFlowComplete: () => {
                    console.log(`[业务侧] 恭喜！整个剧本通关！`);
                }
            },

            // 6. debug
            debug: true
        }
    });

    // 🚀 保持你原来的行为
    guide.start();

    return guide;
}

// ---------------- App ----------------
const app = createApp(App)

// 创建实例（可替换 / 可测试）
const guide = createFlowGuide()

// 注入（无 window，全局干净）
app.provide('flowGuide', guide)
app.provide('flowRuntime', guide.runtime)

app.mount('#app')
