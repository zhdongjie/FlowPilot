<script setup lang="ts">
import { ref } from 'vue'
import axios from 'axios'

// 响应式状态
const isLoggedIn = ref(false)
const showForm = ref(false)
const formData = ref({
  userName: '',
  idCard: ''
})

/**
 * 登录逻辑
 * 成功后会由 SDK 的 AxiosAdapter 发出 'login_success' 信号
 */
const handleLogin = async () => {
  console.log("业务层：发起登录请求...")
  try {
    const res = await axios.post('/api/login')
    if (res.data.code === 'login_success') {
      isLoggedIn.value = true
    }
  } catch (e) {
    console.error("登录失败", e)
  }
}

/**
 * 提交开户表单
 * 成功后会由 SDK 的 AxiosAdapter 发出 'submit_success' 信号
 */
const handleSubmit = async () => {
  console.log("业务层：发起开户申请...", formData.value)
  try {
    const res = await axios.post('/api/submit', formData.value)
    if (res.data.code === 'submit_success') {
      // 提交成功后隐藏表单，触发后续的通关引导
      showForm.value = false
    }
  } catch (e) {
    console.error("提交失败", e)
  }
}
</script>

<template>
  <div class="container">
    <h2>FlowPilot 工业级引导演练场</h2>

    <div v-if="!isLoggedIn" class="card login-box">
      <h3>系统登录</h3>
      <p>请点击登录按钮开始您的开户旅程</p>
      <button
          id="login-btn"
          data-fp="login_btn"
          class="btn-primary"
          @click="handleLogin"
      >
        安全登录
      </button>
    </div>

    <div v-else class="main-content">
      <header class="dashboard-header">
        <span class="user-info">欢迎，管理员</span>
        <button
            v-if="!showForm"
            data-fp="open_account_btn"
            class="btn-secondary"
            @click="showForm = true"
        >
          我要开户
        </button>
      </header>

      <div
          v-if="showForm"
          id="account-form"
          class="card form-container"
      >
        <h3>开户申请表</h3>
        <p class="form-desc">请填写以下信息以完成实名认证</p>

        <div class="form-group">
          <label>真实姓名</label>
          <input
              v-model="formData.userName"
              data-fp="user_name"
              type="text"
              placeholder="请输入姓名"
              class="form-input"
          />
        </div>

        <div class="form-group">
          <label>身份证号</label>
          <input
              v-model="formData.idCard"
              data-fp="id_card"
              type="text"
              placeholder="请输入18位身份证号"
              class="form-input"
          />
        </div>

        <div class="form-actions">
          <button
              id="submit-btn"
              data-fp="submit_btn"
              class="btn-submit"
              @click="handleSubmit"
          >
            确认提交申请
          </button>
        </div>
      </div>

      <div v-if="isLoggedIn && !showForm" class="success-placeholder">
        <p>感谢您的提交，审核结果将通过短信通知。</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.container {
  max-width: 800px;
  margin: 50px auto;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #333;
}

h2 { text-align: center; color: #1a1a1a; margin-bottom: 40px; }

.card {
  background: #fff;
  border-radius: 12px;
  padding: 30px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
  border: 1px solid #eee;
}

.login-box { text-align: center; max-width: 400px; margin: 0 auto; }

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 25px;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 30px;
}

.form-container { margin-top: 20px; }

.form-group { margin-bottom: 20px; }
.form-group label { display: block; margin-bottom: 8px; font-weight: 500; }
.form-input {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  box-sizing: border-box;
}
.form-input:focus { border-color: #007aff; outline: none; box-shadow: 0 0 0 3px rgba(0,122,255,0.1); }

.btn-primary { background: #007aff; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; width: 100%; font-size: 16px; }
.btn-secondary { background: #34c759; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; }
.btn-submit { background: #1a1a1a; color: white; border: none; padding: 14px; border-radius: 6px; cursor: pointer; width: 100%; font-size: 16px; font-weight: 600; }

.success-placeholder { text-align: center; margin-top: 50px; color: #666; }
</style>
