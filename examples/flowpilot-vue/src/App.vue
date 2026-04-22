<script setup lang="ts">
import { ref, inject } from 'vue'
import axios from 'axios'

// 🌟 从 Vue 注入拿 runtime（干净！）
const runtime = inject<any>('flowRuntime', null)

// --- 业务状态 ---
const isLoggedIn = ref(false)
const showForm = ref(false)

const formData = ref({
  userName: '',
  idCard: ''
})

// ---------------- 登录 ----------------
const handleLogin = async () => {
  const res = await axios.post('/api/login')
  if (res.data.code === 'login_success') {
    isLoggedIn.value = true
  }
}

// ---------------- 提交 ----------------
const handleSubmit = async () => {
  const res = await axios.post('/api/submit', formData.value)
  if (res.data.code === 'submit_success') {
    showForm.value = false
  }
}

// ---------------- 返回（🌟 只调 SDK API） ----------------
const handleGoBack = () => {
  showForm.value = false
}

// ---------------- 重置（🌟 正确做法） ----------------
const handleResetAll = () => {
  // 1️⃣ 重置 SDK
  runtime?.reset?.()

  // 2️⃣ 重置业务 UI
  isLoggedIn.value = false
  showForm.value = false
  formData.value = {
    userName: '',
    idCard: ''
  }
}
</script>
<template>
  <div class="container">
    <div class="header-actions">
      <h2>FlowPilot 工业级引导演练场</h2>
      <button class="btn-reset" @click="handleResetAll">
        🔄 重置缓存并重来
      </button>
    </div>

    <!-- 登录态 -->
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

    <!-- 主界面 -->
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

      <!-- 表单 -->
      <div v-if="showForm" id="account-form" class="card form-container">
        <button class="btn-back" @click="handleGoBack">
          ⬅ 返回工作台
        </button>

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

      <!-- 成功态 -->
      <div v-if="isLoggedIn && !showForm" class="success-placeholder">
        <p>感谢您的提交，审核结果将通过短信通知。</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.container {
  max-width: 800px;
  margin: 50px 400px 50px auto;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  transition: all 0.3s ease;
}

.header-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 40px;
}
.header-actions h2 { margin-bottom: 0; }

.btn-reset {
  background: #ff3b30;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}
.btn-reset:hover { opacity: 0.8; }

.btn-back {
  background: none;
  border: none;
  color: #007aff;
  cursor: pointer;
  padding: 0;
  font-size: 14px;
  margin-bottom: 15px;
}
.btn-back:hover { text-decoration: underline; }

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

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
}

.form-input {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  box-sizing: border-box;
}

.form-input:focus {
  border-color: #007aff;
  outline: none;
  box-shadow: 0 0 0 3px rgba(0,122,255,0.1);
}

.btn-primary {
  background: #007aff;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 6px;
  cursor: pointer;
  width: 100%;
  font-size: 16px;
}

.btn-secondary {
  background: #34c759;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
}

.btn-submit {
  background: #1a1a1a;
  color: white;
  border: none;
  padding: 14px;
  border-radius: 6px;
  cursor: pointer;
  width: 100%;
  font-size: 16px;
  font-weight: 600;
}

.success-placeholder {
  text-align: center;
  margin-top: 50px;
  color: #666;
}
</style>
