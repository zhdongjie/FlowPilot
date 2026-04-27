<script setup lang="ts">
import { inject, onBeforeUnmount, ref } from "vue";
import axios from "axios";
import type { GuideController } from "flowpilot";

import {
    demoGuideServiceKey,
    type DemoGuideId,
    type DemoGuideMeta
} from "./guide-demo";

type ActivePanel = "dashboard" | "account" | "profile";

const guideDemo = inject(demoGuideServiceKey, null);
const guideEntries = guideDemo?.listGuides() ?? [];

const isLoggedIn = ref(false);
const activePanel = ref<ActivePanel>("dashboard");
const accountSubmitted = ref(false);
const profileSaved = ref(false);

const formData = ref({
    userName: "",
    idCard: ""
});

const profileData = ref({
    mobile: "",
    email: ""
});

const isGuideLoading = ref(false);
const activeGuide = ref<DemoGuideMeta | null>(null);
const guideStatus = ref("选择一个入口来初始化对应引导");
const guideError = ref("");

let stopGuideWatch: (() => void) | null = null;
let launchToken = 0;

function requireGuideDemo() {
    if (!guideDemo) {
        throw new Error("Guide demo service is not available.");
    }

    return guideDemo;
}

function resetBusinessState() {
    isLoggedIn.value = false;
    activePanel.value = "dashboard";
    accountSubmitted.value = false;
    profileSaved.value = false;

    formData.value = {
        userName: "",
        idCard: ""
    };

    profileData.value = {
        mobile: "",
        email: ""
    };
}

function clearGuideWatch() {
    stopGuideWatch?.();
    stopGuideWatch = null;
}

function bindGuideLifecycle(controller: GuideController, guide: DemoGuideMeta) {
    clearGuideWatch();

    stopGuideWatch = controller.runtime.subscribe(() => {
        if (!controller.isFinished()) {
            return;
        }

        activeGuide.value = null;
        guideStatus.value = `${guide.title} 已完成，实例已自动销毁`;
        clearGuideWatch();
    });
}

function getGuideMeta(id: DemoGuideId) {
    return guideEntries.find((guide) => guide.id === id);
}

async function launchGuide(id: DemoGuideId) {
    const service = requireGuideDemo();
    const guide = getGuideMeta(id);

    if (!guide) {
        throw new Error(`Unknown demo guide: ${id}`);
    }

    const token = ++launchToken;

    clearGuideWatch();
    activeGuide.value = null;
    guideError.value = "";
    guideStatus.value = `正在初始化 ${guide.title}...`;
    isGuideLoading.value = true;

    service.destroyCurrentGuide({ clearCache: true });
    resetBusinessState();

    try {
        const controller = await service.openGuide(id);

        if (token !== launchToken) {
            return;
        }

        if (!controller) {
            guideStatus.value = "新的引导请求已经接管当前初始化";
            return;
        }

        activeGuide.value = guide;
        guideStatus.value = `${guide.title} 运行中`;
        bindGuideLifecycle(controller, guide);
    } catch (error) {
        if (token !== launchToken) {
            return;
        }

        guideStatus.value = `${guide.title} 启动失败`;
        guideError.value = error instanceof Error ? error.message : "未知错误";
        service.destroyCurrentGuide({ clearCache: true });
    } finally {
        if (token === launchToken) {
            isGuideLoading.value = false;
        }
    }
}

function destroyCurrentGuide() {
    launchToken += 1;
    clearGuideWatch();
    guideDemo?.destroyCurrentGuide({ clearCache: true });

    guideStatus.value = activeGuide.value
        ? `${activeGuide.value.title} 已手动销毁`
        : "当前没有运行中的引导";
    guideError.value = "";
    activeGuide.value = null;
    isGuideLoading.value = false;
}

async function handleLogin() {
    const response = await axios.post("/api/login");

    if (response.data.code === "login_success") {
        isLoggedIn.value = true;
        activePanel.value = "dashboard";
    }
}

function openAccountCenter() {
    activePanel.value = "account";
}

function openProfileCenter() {
    activePanel.value = "profile";
}

async function handleSubmitAccount() {
    const response = await axios.post("/api/submit", formData.value);

    if (response.data.code === "submit_success") {
        accountSubmitted.value = true;
        activePanel.value = "dashboard";
    }
}

async function handleSaveProfile() {
    const response = await axios.post("/api/profile/save", profileData.value);

    if (response.data.code === "profile_save_success") {
        profileSaved.value = true;
        activePanel.value = "dashboard";
    }
}

function handleBackToDashboard() {
    activePanel.value = "dashboard";
}

function handleResetAll() {
    destroyCurrentGuide();
    guideStatus.value = "演示已重置，可重新启动任一引导";
    resetBusinessState();
}

function getSourceKindLabel(sourceKind: DemoGuideMeta["sourceKind"]) {
    return sourceKind === "static-json" ? "静态资源" : "模拟请求";
}

onBeforeUnmount(() => {
    clearGuideWatch();
    guideDemo?.destroyCurrentGuide({ clearCache: true });
});
</script>

<template>
  <div class="container">
    <div class="header-actions">
      <div>
        <p class="eyebrow">FlowPilot Demo</p>
        <h2>双引导会话演练场</h2>
      </div>
      <button class="btn-reset" @click="handleResetAll">
        重置页面并销毁引导
      </button>
    </div>

    <section class="card guide-hub">
      <div class="guide-hub-copy">
        <h3>多引导注册表</h3>
        <p>
          页面不再关心某条引导是静态配置还是接口返回，只负责按
          guideId 打开、切换和销毁。你后面继续加引导时，只需要在注册表里增加一项。
        </p>
      </div>

      <div class="launcher-grid">
        <article
          v-for="guide in guideEntries"
          :key="guide.id"
          class="launcher-card"
          :class="{ 'launcher-card--active': activeGuide?.id === guide.id }"
        >
          <div class="launcher-card__header">
            <h4>{{ guide.title }}</h4>
            <span class="source-badge">{{ getSourceKindLabel(guide.sourceKind) }}</span>
          </div>
          <p>{{ guide.description }}</p>
          <button
            class="btn-launch"
            :disabled="isGuideLoading"
            @click="launchGuide(guide.id)"
          >
            {{ guide.startLabel }}
          </button>
        </article>
      </div>

      <div class="guide-toolbar">
        <button
          class="btn-outline"
          :disabled="!activeGuide && !isGuideLoading"
          @click="destroyCurrentGuide"
        >
          销毁当前引导
        </button>
      </div>

      <div
        class="guide-status"
        :class="{
          'guide-status--active': Boolean(activeGuide),
          'guide-status--busy': isGuideLoading
        }"
      >
        <p>{{ activeGuide ? `当前引导：${activeGuide.title}` : "当前没有运行中的引导" }}</p>
        <span>{{ guideStatus }}</span>
        <span v-if="guideError" class="guide-error">{{ guideError }}</span>
      </div>
    </section>

    <div v-if="!isLoggedIn" class="card login-box">
      <h3>系统登录</h3>
      <p class="page-note">
        先启动任一引导，再点击登录按钮体验完整流程。
      </p>
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
        <div>
          <span class="user-info">欢迎，管理员</span>
          <p class="dashboard-note">
            当前页面同时承载两条业务链路，用来模拟同一系统中的多引导切换。
          </p>
        </div>
      </header>

      <div v-if="activePanel === 'dashboard'" class="panel-grid">
        <section class="card feature-card">
          <p class="feature-tag">开户服务</p>
          <h3>开户注册</h3>
          <p>填写实名信息，提交开卡申请。</p>
          <button
            data-fp="open_account_btn"
            class="btn-secondary btn-block"
            @click="openAccountCenter"
          >
            我要开卡
          </button>
        </section>

        <section class="card feature-card">
          <p class="feature-tag">资料维护</p>
          <h3>完善联系信息</h3>
          <p>补充手机号和邮箱，方便接收业务通知。</p>
          <button
            data-fp="profile_center_btn"
            class="btn-outline btn-block"
            @click="openProfileCenter"
          >
            去完善
          </button>
        </section>
      </div>

      <div
        v-if="activePanel === 'dashboard' && (accountSubmitted || profileSaved)"
        class="result-grid"
      >
        <section
          v-if="accountSubmitted"
          data-fp="account_success_card"
          class="card result-card result-card--success"
        >
          <h4>开户申请已提交</h4>
          <p>材料已经进入审核队列，审核结果将通过短信通知。</p>
        </section>

        <section
          v-if="profileSaved"
          data-fp="profile_success_card"
          class="card result-card result-card--accent"
        >
          <h4>联系资料已更新</h4>
          <p>新的手机号和邮箱已经保存，后续通知会优先发送到这里。</p>
        </section>
      </div>

      <section
        v-if="activePanel === 'account'"
        id="account-form"
        class="card form-container"
      >
        <button class="btn-back" @click="handleBackToDashboard">
          返回工作台
        </button>

        <h3>开户申请表</h3>
        <p class="page-note">请填写实名信息，提交开户申请。</p>

        <div class="form-group">
          <label for="user-name">真实姓名</label>
          <input
            id="user-name"
            v-model="formData.userName"
            data-fp="user_name"
            type="text"
            placeholder="请输入姓名"
            class="form-input"
          />
        </div>

        <div class="form-group">
          <label for="id-card">身份证号</label>
          <input
            id="id-card"
            v-model="formData.idCard"
            data-fp="id_card"
            type="text"
            placeholder="请输入 18 位身份证号"
            class="form-input"
          />
        </div>

        <div class="form-actions">
          <button
            id="submit-btn"
            data-fp="submit_btn"
            class="btn-submit"
            @click="handleSubmitAccount"
          >
            确认提交申请
          </button>
        </div>
      </section>

      <section
        v-if="activePanel === 'profile'"
        id="profile-form"
        class="card form-container"
      >
        <button class="btn-back" @click="handleBackToDashboard">
          返回工作台
        </button>

        <h3>资料完善</h3>
        <p class="page-note">补充联系信息，确保后续通知可以准确触达。</p>

        <div class="form-group">
          <label for="profile-mobile">手机号</label>
          <input
            id="profile-mobile"
            v-model="profileData.mobile"
            data-fp="profile_mobile"
            type="text"
            placeholder="请输入常用手机号"
            class="form-input"
          />
        </div>

        <div class="form-group">
          <label for="profile-email">邮箱</label>
          <input
            id="profile-email"
            v-model="profileData.email"
            data-fp="profile_email"
            type="email"
            placeholder="请输入常用邮箱"
            class="form-input"
          />
        </div>

        <div class="form-actions">
          <button
            id="save-profile-btn"
            data-fp="save_profile_btn"
            class="btn-submit"
            @click="handleSaveProfile"
          >
            保存资料
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.container {
  max-width: 1040px;
  margin: 48px auto 72px;
  padding: 0 24px;
  color: #18212f;
  font-family: "Segoe UI", Roboto, sans-serif;
}

.card {
  border: 1px solid #e4e8f1;
  border-radius: 20px;
  background: #ffffff;
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.08);
}

.header-actions {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  margin-bottom: 28px;
}

.header-actions h2 {
  margin: 6px 0 0;
  font-size: 34px;
}

.eyebrow {
  margin: 0;
  color: #0f7bff;
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.guide-hub {
  margin-bottom: 28px;
  padding: 26px;
  background:
    radial-gradient(circle at top right, rgba(15, 123, 255, 0.18), transparent 35%),
    linear-gradient(135deg, #ffffff, #f5f9ff);
}

.guide-hub-copy h3,
.login-box h3,
.feature-card h3,
.form-container h3 {
  margin: 0 0 8px;
}

.guide-hub-copy p,
.page-note,
.dashboard-note,
.feature-card p,
.guide-status span,
.result-card p,
.launcher-card p {
  margin: 0;
  color: #5a6475;
  line-height: 1.6;
}

.launcher-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin: 22px 0 16px;
}

.launcher-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
  border: 1px solid #dbe4f0;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.92);
}

.launcher-card--active {
  border-color: rgba(52, 199, 89, 0.45);
  box-shadow: inset 0 0 0 1px rgba(52, 199, 89, 0.15);
}

.launcher-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.launcher-card__header h4 {
  margin: 0;
  font-size: 18px;
}

.source-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(15, 123, 255, 0.1);
  color: #0f5ccc;
  font-size: 12px;
  font-weight: 700;
}

.guide-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 14px;
}

.guide-status {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 16px;
  border: 1px solid #d6ddeb;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.88);
}

.guide-status p {
  margin: 0;
  font-weight: 600;
}

.guide-status--active {
  border-color: rgba(52, 199, 89, 0.55);
  background: rgba(52, 199, 89, 0.08);
}

.guide-status--busy {
  border-color: rgba(255, 176, 32, 0.55);
  background: rgba(255, 176, 32, 0.08);
}

.guide-error {
  color: #d14343;
}

.btn-reset,
.btn-primary,
.btn-secondary,
.btn-outline,
.btn-submit,
.btn-launch {
  border: none;
  border-radius: 12px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
  transition: transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease;
}

.btn-reset,
.btn-primary,
.btn-launch,
.btn-submit {
  color: #ffffff;
}

.btn-reset {
  padding: 12px 18px;
  background: linear-gradient(135deg, #ff6b5a, #ff3b30);
  box-shadow: 0 14px 28px rgba(255, 59, 48, 0.22);
}

.btn-launch {
  width: 100%;
  padding: 12px 18px;
  background: linear-gradient(135deg, #0f7bff, #41a2ff);
  box-shadow: 0 16px 30px rgba(15, 123, 255, 0.22);
}

.btn-primary {
  width: 100%;
  padding: 14px 24px;
  background: linear-gradient(135deg, #0f7bff, #2f8cff);
  box-shadow: 0 16px 30px rgba(15, 123, 255, 0.2);
}

.btn-secondary {
  background: linear-gradient(135deg, #18b36b, #33cf86);
  color: #ffffff;
  padding: 12px 16px;
  box-shadow: 0 14px 24px rgba(24, 179, 107, 0.2);
}

.btn-outline {
  padding: 12px 16px;
  border: 1px solid #b8c5db;
  background: #ffffff;
  color: #1f3b63;
}

.btn-submit {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #1f2937, #38465c);
  box-shadow: 0 16px 28px rgba(31, 41, 55, 0.18);
}

.btn-block {
  width: 100%;
}

.btn-reset:hover,
.btn-primary:hover,
.btn-secondary:hover,
.btn-outline:hover,
.btn-submit:hover,
.btn-launch:hover {
  transform: translateY(-1px);
}

.btn-reset:disabled,
.btn-primary:disabled,
.btn-secondary:disabled,
.btn-outline:disabled,
.btn-submit:disabled,
.btn-launch:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.login-box,
.form-container {
  padding: 28px;
}

.login-box {
  max-width: 420px;
  margin: 0 auto;
  text-align: center;
}

.main-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.dashboard-header {
  padding: 20px 24px;
  border: 1px solid #e4e8f1;
  border-radius: 18px;
  background: #f8fbff;
}

.user-info {
  display: inline-block;
  margin-bottom: 8px;
  font-size: 18px;
  font-weight: 700;
}

.panel-grid,
.result-grid {
  display: grid;
  gap: 20px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.feature-card,
.result-card {
  padding: 24px;
}

.feature-tag {
  margin-bottom: 10px;
  color: #0f7bff;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.result-card h4 {
  margin: 0 0 10px;
}

.result-card--success {
  border-color: rgba(52, 199, 89, 0.35);
  background: linear-gradient(135deg, rgba(52, 199, 89, 0.08), #ffffff);
}

.result-card--accent {
  border-color: rgba(15, 123, 255, 0.3);
  background: linear-gradient(135deg, rgba(15, 123, 255, 0.08), #ffffff);
}

.btn-back {
  margin-bottom: 18px;
  padding: 0;
  border: none;
  background: none;
  color: #0f7bff;
  cursor: pointer;
  font-size: 14px;
}

.form-group {
  margin-top: 18px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
}

.form-input {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid #d6ddeb;
  border-radius: 12px;
  box-sizing: border-box;
  font-size: 15px;
}

.form-input:focus {
  outline: none;
  border-color: #0f7bff;
  box-shadow: 0 0 0 4px rgba(15, 123, 255, 0.1);
}

.form-actions {
  margin-top: 22px;
}

@media (max-width: 720px) {
  .container {
    margin: 32px auto 48px;
    padding: 0 16px;
  }

  .header-actions,
  .guide-toolbar {
    flex-direction: column;
  }

  .launcher-grid,
  .panel-grid,
  .result-grid {
    grid-template-columns: 1fr;
  }

  .header-actions h2 {
    font-size: 28px;
  }
}
</style>
