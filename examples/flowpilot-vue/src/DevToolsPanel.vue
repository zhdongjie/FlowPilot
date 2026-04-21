<template>
  <div class="flow-devtools">
    <div class="header">🛠️ FlowPilot 实时观测台</div>

    <div class="diagnostics-panel" v-if="activeDiagnostics.length > 0">
      <div v-for="diag in activeDiagnostics" :key="diag.stepId" class="diag-card">
        <div class="diag-title">
          <span class="pulse-icon">🔍</span>
          正在阻塞: <span class="step-name">{{ diag.stepId }}</span>
        </div>
        <DevToolsDAG :diagnosticTree="diag.tree" :stepId="diag.stepId" />
      </div>
    </div>
    <div v-else class="finish-panel">
      <div class="finish-icon">✅</div>
      <div class="finish-text">流程已全部完成</div>
    </div>

    <div class="timeline">
      <div v-if="events.length === 0" class="empty">等待引擎数据...</div>

      <div v-for="(event, index) in events" :key="index" class="event-card">
        <div class="event-time">{{ formatTime(event.timestamp) }}</div>

        <div class="event-body">
          <span class="event-type" :class="event.type.toLowerCase()">{{ event.type }}</span>
          <span v-if="event.key" class="event-key">🔑 {{ event.key }}</span>
          <span v-if="event.stepId" class="event-step">🏷️ {{ event.stepId }}</span>
        </div>

        <button
            class="rewind-btn"
            @click="handleRewind(event.timestamp)"
            title="回溯到此时刻"
        >
          ⏪
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { FlowDevTools } from 'flowpilot';
import type { FlowRuntime } from 'flowpilot';
// 确保路径指向你自己的 DevToolsDAG 组件
import DevToolsDAG from './DevToolsDAG.vue';

const props = defineProps<{
  runtime: FlowRuntime | null;
}>();

const devtools = new FlowDevTools();
const events = ref<any[]>([]);
const activeDiagnostics = ref<any[]>([]);
let switchTimer: any = null;

/**
 * 时间回溯：调用 SDK 底层能力
 */
const handleRewind = (ts: number) => {
  if (!props.runtime) return;

  // 🌟 核心改进 1：回溯时立即清除所有视觉锁定，确保 UI 瞬间刷新
  if (switchTimer) {
    clearTimeout(switchTimer);
    switchTimer = null;
  }

  console.log(`[DevTools] ⏪ 正在回溯至: ${ts}`);
  devtools.rewindTime(props.runtime, ts);
};

onMounted(() => {
  if (props.runtime) {
    devtools.connect(props.runtime, () => {
      events.value = [...devtools.getEvents()].reverse();

      const next = devtools.getActiveDiagnostics();
      const prev = activeDiagnostics.value;
      const currentId = prev[0]?.stepId;
      const nextId = next[0]?.stepId;

      const runtime = props.runtime;
      if (!runtime) return;

      const allEvents = devtools.getEvents();
      events.value = [...allEvents].reverse();

      const trace = runtime.engine.trace.all();
      const isRewinding = trace.length > 0 && trace[trace.length - 1].type === 'REVERT';

      if (isRewinding) {
        // 如果是回溯，立即杀掉计时器，强行同步 UI
        if (switchTimer) {
          clearTimeout(switchTimer);
          switchTimer = null;
        }
        activeDiagnostics.value = next;
        return; // 结束，不走后面的 800ms 锁定逻辑
      }

      // 🌟 核心改进 2：区分是“前进”还是“后退”
      // 我们通过判断 nextId 是否在已完成列表里，或者简单的“步骤切换”逻辑

      const isSteppingForward = currentId && nextId && currentId !== nextId;
      const isFinishing = currentId && !nextId;

      if (isSteppingForward || isFinishing) {
        // 只有【正常通关】才需要 800ms 视觉锁定
        prev.forEach(diag => forceMarkPassed(diag.tree));

        if (switchTimer) clearTimeout(switchTimer);
        switchTimer = setTimeout(() => {
          activeDiagnostics.value = next;
          switchTimer = null;
        }, 800);
      } else {
        // 如果是【回溯】或【同步骤更新】，直接渲染，不加延迟
        if (!switchTimer) {
          activeDiagnostics.value = next;
        }
      }
    });
  }
});

/**
 * 递归强制点亮节点 (视觉欺骗的核心)
 */
function forceMarkPassed(node: any) {
  if (!node) return;
  node.passed = true;
  if (node.children && Array.isArray(node.children)) {
    node.children.forEach(forceMarkPassed);
  }
}

/**
 * 时间格式化：保持毫秒精度以便调试
 */
const formatTime = (ts: number) => {
  const d = new Date(ts);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  const s = d.getSeconds().toString().padStart(2, '0');
  const ms = d.getMilliseconds().toString().padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
};

onUnmounted(() => {
  devtools.disconnect();
  if (switchTimer) clearTimeout(switchTimer);
});
</script>

<style scoped>
.flow-devtools {
  position: fixed;
  right: 20px;
  top: 20px;
  width: 420px;
  height: 88vh;
  background: #1e1e1e;
  color: #e0e0e0;
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.6);
  display: flex;
  flex-direction: column;
  font-family: 'Fira Code', 'Monaco', monospace;
  z-index: 99999;
  border: 1px solid #333;
  overflow: hidden;
}

.header {
  padding: 16px;
  background: #252526;
  font-weight: bold;
  border-bottom: 1px solid #333;
  color: #4fc3f7;
  letter-spacing: 0.5px;
}

.diagnostics-panel {
  padding: 12px;
  background: #2d2d2d;
  border-bottom: 2px solid #007aff;
}

.diag-title {
  font-size: 13px;
  color: #888;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
}

.step-name {
  color: #f1c40f;
  margin-left: 6px;
  font-weight: bold;
}

.finish-panel {
  padding: 30px;
  text-align: center;
  background: #252526;
}

.finish-icon { font-size: 40px; margin-bottom: 10px; }
.finish-text { color: #28a745; font-weight: bold; }

.timeline {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: #121212;
}

.event-card {
  background: #1e1e1e;
  padding: 12px;
  border-left: 4px solid #444;
  border-radius: 4px;
  font-size: 12px;
  position: relative;
  transition: transform 0.2s;
}

.event-card:hover {
  background: #252526;
  transform: translateX(4px);
}

.event-time { color: #555; margin-bottom: 6px; font-size: 10px; }

.event-body { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }

.event-type {
  padding: 2px 6px;
  background: #333;
  border-radius: 4px;
  font-weight: bold;
  font-size: 10px;
  text-transform: uppercase;
}

/* 信号颜色定义 */
.event-type.signal_ingest { background: #007bff; color: white; }
.event-type.step_advance { background: #28a745; color: white; }
.event-type.revert { background: #dc3545; color: white; }
.event-type.engine_init { background: #666; color: white; }

.event-key { color: #f39c12; font-weight: bold; }
.event-step { color: #17a2b8; font-style: italic; }

.rewind-btn {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: #333;
  border: 1px solid #444;
  color: #fff;
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
  opacity: 0;
  transition: 0.2s;
}

.event-card:hover .rewind-btn { opacity: 1; }
.rewind-btn:hover { background: #007aff; border-color: #007aff; }

.empty { text-align: center; color: #444; margin-top: 40px; font-style: italic; }

.pulse-icon {
  animation: pulse-blue 2s infinite;
}

@keyframes pulse-blue {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}
</style>
