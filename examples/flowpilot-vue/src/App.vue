<script setup lang="ts">
import { ref } from 'vue'
import axios from 'axios'

const isLoggedIn = ref(false)
const showForm = ref(false)

// 🌟 看这里！完全就是最普通的业务代码，没有任何引导相关的逻辑！
const handleLogin = async () => {
  console.log("业务代码：正在发起 POST /api/login ...")
  try {
    const res = await axios.post('/api/login', { username: 'admin' })
    if (res.data.code === 'login_success') {
      isLoggedIn.value = true
      console.log("业务代码：登录成功，渲染 Dashboard")
    }
  } catch (e) {
    console.error(e)
  }
}

const handleSubmit = async () => {
  console.log("业务代码：正在发起 POST /api/submit ...")
  try {
    const res = await axios.post('/api/submit', { idCard: '123456' })
    if (res.data.code === 'submit_success') {
      showForm.value = false
      alert("表单提交成功！")
    }
  } catch (e) {
    console.error(e)
  }
}
</script>

<template>
  <div style="padding: 50px; font-family: sans-serif;">
    <h2>FlowPilot 工业级 E2E 测试演练场</h2>

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
