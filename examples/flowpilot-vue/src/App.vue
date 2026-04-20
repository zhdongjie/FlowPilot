<script setup lang="ts">
import { ref, inject } from 'vue'

const isLoggedIn = ref(false)
const showForm = ref(false)

// 拿到我们注入的全局采集器（用于模拟 Axios 事实）
const collector = inject('flowCollector') as any

const handleLogin = () => {
  console.log("模拟请求：正在登录...")
  setTimeout(() => {
    isLoggedIn.value = true
    // 模拟 Axios 拦截器发出的事实信号
    collector.emit('login_success')
  }, 1000)
}

const handleSubmit = () => {
  console.log("模拟请求：正在提交...")
  setTimeout(() => {
    showForm.value = false
    collector.emit('submit_success')
  }, 500)
}
</script>

<template>
  <div style="padding: 50px; font-family: sans-serif;">
    <h2>FlowPilot E2E 测试演练场</h2>

    <div v-if="!isLoggedIn" style="margin-top: 50px;">
      <input type="text" placeholder="Username" style="padding: 8px; margin-right: 10px;"/>
      <button id="login-btn" data-fp="login_btn" @click="handleLogin" style="padding: 8px 16px;">
        Login
      </button>
    </div>

    <div v-if="isLoggedIn" style="margin-top: 50px;">
      <nav style="padding: 20px; background: #f0f0f0; border-radius: 8px;">
        <span>Dashboard</span>
        <button data-fp="open_account_btn" @click="showForm = true" style="margin-left: 20px;">
          我要开户
        </button>
      </nav>

      <div v-if="showForm" style="margin-top: 30px; padding: 20px; border: 1px solid #ccc;">
        <h3>开户表单</h3>
        <input type="text" placeholder="身份证号" style="display:block; margin-bottom: 10px;" />
        <button id="submit-btn" data-fp="submit_btn" @click="handleSubmit">确认提交</button>
      </div>
    </div>
  </div>
</template>
