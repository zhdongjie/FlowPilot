<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

import { FlowDevTools } from 'flowpilot';
import type { FlowRuntime } from 'flowpilot';

const props = defineProps<{
  runtime: FlowRuntime | null;
}>();

const devtools = new FlowDevTools();
const events = ref<any[]>([]);

onMounted(() => {
  if (props.runtime) {
    // 🌟 核心：将 SDK 的数据桥接到 Vue 的响应式系统中
    devtools.connect(props.runtime, () => {
      // 每次底层有新事件，都会触发这里，给 Vue 的 ref 赋新值
      events.value = [...devtools.getEvents()];
    });
  }
});

onUnmounted(() => {
  devtools.disconnect();
});

// 🌟 时空穿梭魔法：一键回放
const handleRewind = (ts: number) => {
  if (!props.runtime) return;
  console.log(`[DevTools] ⏪ 正在时空穿梭至: ${ts}`);
  devtools.rewindTime(props.runtime, ts);
};

// 格式化时间戳的辅助函数
const formatTime = (ts: number) => {
  const d = new Date(ts);
  return `${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}.${d.getMilliseconds()}`;
};
</script>

<template>
  <div class="flow-devtools">
    <div class="header">🛠️ FlowPilot 实时观测台</div>

    <div class="timeline">
      <div v-if="events.length === 0" class="empty">等待引擎数据...</div>

      <div v-for="(event, index) in events" :key="index" class="event-card">
        <div class="event-time">{{ formatTime(event.timestamp) }}</div>
        <div class="event-body">
          <span class="event-type" :class="event.type.toLowerCase()">{{ event.type }}</span>
          <span v-if="event.key" class="event-key">🔑 {{ event.key }}</span>
          <span v-if="event.stepId" class="event-step">🏷️ {{ event.stepId }}</span>
        </div>

        <button class="rewind-btn" @click="handleRewind(event.timestamp)" title="回溯到此时刻">
          ⏪
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.flow-devtools {
  position: fixed;
  right: 20px;
  top: 20px;
  width: 350px;
  height: 80vh;
  background: #1e1e1e;
  color: #e0e0e0;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  display: flex;
  flex-direction: column;
  font-family: monospace;
  z-index: 99999;
}
.header {
  padding: 15px;
  background: #2d2d2d;
  font-weight: bold;
  border-bottom: 1px solid #444;
  border-radius: 12px 12px 0 0;
}
.timeline {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.event-card {
  background: #2a2a2a;
  padding: 10px;
  border-left: 4px solid #666;
  border-radius: 4px;
  font-size: 12px;
  position: relative;
}
.event-time {
  color: #888;
  margin-bottom: 5px;
  font-size: 10px;
}
.event-type {
  padding: 2px 6px;
  background: #444;
  border-radius: 4px;
  margin-right: 8px;
  font-weight: bold;
}
.event-type.step_advance { background: #28a745; color: white; }
.event-type.signal_ingest { background: #007bff; color: white; }
.event-type.revert { background: #dc3545; color: white; }

.event-key { color: #f39c12; margin-right: 8px;}
.event-step { color: #17a2b8; }
.rewind-btn {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  opacity: 0.3;
  transition: 0.2s;
}
.event-card:hover .rewind-btn {
  opacity: 1;
}
.rewind-btn:hover {
  transform: translateY(-50%) scale(1.2);
}
</style>
