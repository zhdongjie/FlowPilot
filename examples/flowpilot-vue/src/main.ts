// examples/flowpilot-vue/src/main.ts
import { createApp } from 'vue'
import App from './App.vue'
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'

// 🌟 1. 从你纯净的 SDK 引入核心和适配器
import { GuideController, AxiosAdapter } from 'flowpilot'
import { onboardingSteps } from './guide.config'

// --- [后端 Mock 配置] ---
// 模拟真实的后端延迟和返回数据
const mock = new MockAdapter(axios, { delayResponse: 800 });
mock.onPost('/api/login').reply(200, { code: 'login_success', msg: '登录成功' });
mock.onPost('/api/submit').reply(200, { code: 'submit_success', msg: '开户成功' });
// -----------------------

const app = createApp(App)

// 🌟 2. 实例化控制中枢，并挂载网络拦截适配器
const guide = new GuideController({
    steps: onboardingSteps,
    rootStepId: "step_login",
    networkAdapters: [
        new AxiosAdapter(axios) // 把 axios 实例喂给适配器
    ]
});

// Vue 的环境，用 Vue 的方式提供给内部组件 (虽然在这个纯净版 Demo 里我们甚至不需要 inject 了，但留着备用也可以)
app.provide('flowCollector', guide.collector);

// 3. 启动引擎
guide.start();

app.mount('#app')
