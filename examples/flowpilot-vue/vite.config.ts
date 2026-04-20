// examples/flowpilot-vue/vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
    plugins: [vue()],
    resolve: {
        alias: {
            // 🌟 魔法在这里：拦截 'flowpilot' 的导入，直接指向本地 SDK 源码
            'flowpilot': path.resolve(__dirname, '../../flowpilot/src/sdk/index.ts')
        }
    }
})
