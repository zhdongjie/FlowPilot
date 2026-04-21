<script setup lang="ts">
import { ref, onMounted } from 'vue'
import axios from 'axios'

// 🌟 引入刚写好的观测组件
import DevToolsPanel from './DevToolsPanel.vue'

// --- [业务响应式状态] ---
const isLoggedIn = ref(false)
const showForm = ref(false)
const formData = ref({
  userName: '',
  idCard: ''
})

// --- [SDK 观测状态] ---
const runtime = ref<any>(null)

onMounted(() => {
  // 🌟 从 window 拿到全局导引实例（由 main.ts 挂载）
  // 稍微延迟 100ms 确保 SDK 初始化完成
  setTimeout(() => {
    if ((window as any).__FLOW_GUIDE__) {
      runtime.value = (window as any).__FLOW_GUIDE__.runtime
      console.log("🛠️ [App] 已成功连接 FlowPilot 运行时")
    }
  }, 100)
})

/**
 * 登录逻辑
 * 成功后由 AxiosAdapter 发出 'login_success' 信号
 */
const handleLogin = async () => {
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
 * 提交表单
 * 成功后由 AxiosAdapter 发出 'submit_success' 信号
 */
const handleSubmit = async () => {
  try {
    const res = await axios.post('/api/submit', formData.value)
    if (res.data.code === 'submit_success') {
      showForm.value = false
    }
  } catch (e) {
    console.error("提交失败", e)
  }
}

// ==========================================
// 🚀 新增：业务与引导的互动逻辑
// ==========================================

/**
 * 🌟 局部返回逻辑：业务退回工作台，引导时光倒流
 */
const handleGoBack = () => {
  // 1. 业务层面：隐藏表单，退回工作台
  showForm.value = false;

  // 2. 引导层面：呼叫 SDK 截断记忆并重启
  // ⚠️ 这里的 'step_open_account' 是我要开户那一步的 ID，若你的 config 命名不同请修改
  if ((window as any).__FLOW_GUIDE__) {
    (window as any).__FLOW_GUIDE__.rewindTo('step_open_account');
  }
}

/**
 * 🌟 全局重置逻辑：一键清空持久化缓存，重头再来
 */
const handleResetAll = () => {
  // 清除在 main.ts 中配置的 persistence key 及其通关印章
  localStorage.removeItem('flowpilot_onboarding_v1');
  localStorage.removeItem('flowpilot_onboarding_v1_finished');

  // 直接刷新页面
  window.location.reload();
}
</script>

<template>
  <div class="container">
    <div class="header-actions">
      <h2>FlowPilot 工业级引导演练场</h2>
      <button class="btn-reset" @click="handleResetAll">🔄 重置缓存并重来</button>
    </div>

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

      <div v-if="showForm" id="account-form" class="card form-container">
        <button class="btn-back" @click="handleGoBack">⬅ 返回工作台</button>

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

    <DevToolsPanel v-if="runtime" :runtime="runtime" />
  </div>
</template>

<style scoped>
/* 原有 container 样式保持不变 */
.container {
  max-width: 800px;
  margin: 50px 400px 50px auto;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  transition: all 0.3s ease;
}

/* ============================
   🌟 新增按钮相关样式
============================ */
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
  transition: opacity 0.2s;
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

/* ============================
   原有样式保持不变
============================ */
.login-box { text-align: center; max-width: 400px; margin: 0 auto; }
.dashboard-header { display: flex; justify-content: space-between; align-items: center; padding: 15px 25px; background: #f8f9fa; border-radius: 8px; margin-bottom: 30px; }
.form-container { margin-top: 20px; }
.form-group { margin-bottom: 20px; }
.form-group label { display: block; margin-bottom: 8px; font-weight: 500; }
.form-input { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 6px; box-sizing: border-box; }
.form-input:focus { border-color: #007aff; outline: none; box-shadow: 0 0 0 3px rgba(0,122,255,0.1); }
.btn-primary { background: #007aff; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; width: 100%; font-size: 16px; }
.btn-secondary { background: #34c759; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; }
.btn-submit { background: #1a1a1a; color: white; border: none; padding: 14px; border-radius: 6px; cursor: pointer; width: 100%; font-size: 16px; font-weight: 600; }
.success-placeholder { text-align: center; margin-top: 50px; color: #666; }
</style>
