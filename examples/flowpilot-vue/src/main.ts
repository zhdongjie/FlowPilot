// main.ts
import { createApp } from 'vue'
import App from './App.vue'
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'

import { AxiosAdapter, createFlowGuide, DevToolsPlugin} from 'flowpilot'
import { onboardingSteps } from "./guide.config.ts";


// ---------------- Mock ----------------
const mock = new MockAdapter(axios, { delayResponse: 800 });
mock.onPost('/api/login').reply(200, { code: 'login_success' });
mock.onPost('/api/submit').reply(200, { code: 'submit_success' });

// ---------------- App ----------------
const app = createApp(App)

// ---------------- SDK 实例 ----------------
const guide = createFlowGuide({
    steps: onboardingSteps,
    rootStepId: "step_login",

    adapters: [
        new AxiosAdapter(axios, (res) => {
            if (res.status === 200 && res.data?.code) {
                return res.data.code;
            }
            return null;
        })
    ],

    theme: {
        primaryColor: '#007aff',
        maskColor: 'rgba(0,0,0,0.65)',
        borderRadius: '8px',
        textColor: '#333',
        zIndex: 9999
    },

    ui: {
        defaultPosition: 'bottom',
        defaultNextLabel: '好的，下一步'
    },

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

    hooks: {
        onStepStart: (stepId: string) => {
            console.log(`[业务侧] step start: ${stepId}`);
        },
        onStepComplete: (stepId: string) => {
            console.log(`[业务侧] 用户完成了节点: ${stepId}`);
        },
        onFlowComplete: () => {
            console.log(`[业务侧] done`);
        }
    },

    debug: true
});

if (guide.runtime.getConfig().debug) {
    DevToolsPlugin(guide.runtime);
}

// ---------------- Mount ----------------
app.provide('flowGuide', guide)
app.provide('flowRuntime', guide.runtime)

app.mount('#app')
