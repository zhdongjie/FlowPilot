// examples/flowpilot-vue/src/main.ts
import { createApp } from 'vue'
import App from './App.vue'
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'

import { GuideController, AxiosAdapter } from 'flowpilot'
import { onboardingSteps } from './guide.config'

// --- [后端 Mock 配置] ---
const mock = new MockAdapter(axios, { delayResponse: 800 });
mock.onPost('/api/login').reply(200, { code: 'login_success', msg: '登录成功' });
mock.onPost('/api/submit').reply(200, { code: 'submit_success', msg: '开户成功' });
// -----------------------

const app = createApp(App)

// 核心引擎初始化
const guide = new GuideController({
    steps: onboardingSteps,
    rootStepId: "step_login",

    // 🎨 唯一的超级配置对象，掌管 SDK 的一切
    config: {
        // 1. 网络插件 (拦截 Axios)
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

        // 2. 视觉主题 (如果明天产品要换成骚粉色，只改这里)
        theme: {
            primaryColor: '#007aff', // 极客蓝
            maskColor: 'rgba(0,0,0,0.65)',
            borderRadius: '8px',
            textColor: '#333',
            zIndex: 9999
        },

        // 3. UI 默认行为兜底
        ui: {
            defaultPosition: 'bottom',
            defaultNextLabel: '好的，下一步'
        },

        // 4. 运行逻辑与引擎规范
        runtime: {
            pollingInterval: 50,
            autoStart: true,

            // 自定义锚点属性，实现真正的“零业务侵入”
            attributeName: 'data-fp',
            signalPrefix: {
                click: 'click_',
                focus: 'focus_',
                blur: 'blur_',
                input: 'input_'
            },

            // 记忆功能开启！刷新页面不会从头再来
            persistence: {
                enabled: true,
                key: 'flowpilot_onboarding_v1'
            }
        },

        // 5. 生命周期钩子 (接管业务埋点/撒花特效的枢纽)
        hooks: {
            onStepStart: (stepId) => {
                console.log(`[业务侧] 用户到达了节点: ${stepId}`);
            },
            onStepComplete: (stepId) => {
                console.log(`[业务侧] 用户完成了节点: ${stepId}`);
            },
            onFlowComplete: () => {
                // 真正工业级应用的做法：打个全剧终埋点，并给个弹窗
                console.log(`[业务侧] 恭喜！整个剧本通关！`);
                localStorage.setItem('flowpilot_onboarding_v1_finished', 'true');
            }
        },

        // 6. 开发者调试模式 (排查问题的核武器)
        debug: true
    }
});

// 🚀 启动引擎
guide.start();

(window as any).__FLOW_GUIDE__ = guide;

// 挂载 Vue (看！Vue 组件完全不知道 FlowPilot 的存在)
app.mount('#app')
