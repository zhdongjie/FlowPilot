<template>
  <div class="dag-container">
    <canvas ref="canvasRef" style="width: 100%; height: 240px;"></canvas>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import { buildGraph, DAGRenderer } from 'flowpilot';

const props = defineProps<{
  diagnosticTree: any;
  stepId?: string;
  activeEventKey?: string | null; // 🌟 接收 Hover Key
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
let renderer: DAGRenderer | null = null;

onMounted(() => {
  if (canvasRef.value) {
    renderer = new DAGRenderer(canvasRef.value);
    renderer.start(); // 🌟 启动循环引擎
    updateRenderer();
  }
});

onUnmounted(() => {
  renderer?.stop(); // 清理内存
});

// 🌟 深度监听并仅更新数据，渲染交给 requestAnimationFrame
watch([() => props.diagnosticTree, () => props.activeEventKey], updateRenderer, { deep: true });

function updateRenderer() {
  if (!renderer || !props.diagnosticTree) return;
  const graph = buildGraph(props.diagnosticTree, props.stepId);
  renderer.updateData(graph, props.activeEventKey);
}
</script>
