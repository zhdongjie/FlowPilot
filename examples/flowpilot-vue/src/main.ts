// main.ts
import { createApp } from 'vue'
import App from './App.vue'
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'

import { createFlowPilot, PluginPresets, AxiosPlugin, LoggerPlugin } from 'flowpilot'
import { onboardingSteps } from './guide.config'

// ---------------- Mock ----------------
const mock = new MockAdapter(axios, { delayResponse: 800 })
mock.onPost('/api/login').reply(200, { code: 'login_success' })
mock.onPost('/api/submit').reply(200, { code: 'submit_success' })

// ---------------- FlowPilot Init ----------------
function initFlowPilot() {
    return createFlowPilot({
        preset: PluginPresets.WEB_DEFAULT,

        steps: onboardingSteps,
        rootStepId: "step_login",

        // =========================
        // 只声明“差异化插件”
        // =========================
        plugins: [
            AxiosPlugin({
                instance: axios,
                extractor: (res) => {
                    if (res.data.message === 'success') {
                        return `${res.config.url?.replace('/api/', '')}_success`
                    }
                    if (res.status === 200 && res.data?.code) {
                        return res.data.code
                    }
                    return null
                }
            }),
            LoggerPlugin({
                prefix: 'MyApp-Guide',
                ignoreNoise: true,
                showTiming: true
            })
        ],

        config: {
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
                    key: 'flowpilot_onboarding'
                }
            }
        }
    })
}

// ---------------- App ----------------
const app = createApp(App)

const guide = initFlowPilot()

guide.start()

app.provide('flowGuide', guide)
app.provide('flowRuntime', guide.runtime)

app.mount('#app')
