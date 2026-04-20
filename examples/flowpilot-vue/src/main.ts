// examples/flowpilot-vue/src/main.ts
import { createApp } from 'vue'
import App from './App.vue'
import { GuideController } from 'flowpilot'
import { onboardingSteps } from './guide.config'

const app = createApp(App)

// 1. 初始化 FlowPilot 控制中枢
const guide = new GuideController({
    steps: onboardingSteps,
    rootStepId: "step_login"
});

// 2. 注册 Vue 插件，注入运行时的 runtime
app.provide('flowCollector', guide.collector);

// 3. 启动引擎与采集器
guide.start();

app.mount('#app')
