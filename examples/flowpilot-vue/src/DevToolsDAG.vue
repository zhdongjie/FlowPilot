<template>
  <div class="dag-container">
    <canvas ref="canvasRef" style="width: 100%; height: 200px;"></canvas>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { buildGraph, DAGRenderer } from 'flowpilot';

const props = defineProps<{ diagnosticTree: any; stepId?: string }>();
const canvasRef = ref<HTMLCanvasElement | null>(null);
let renderer: any;

onMounted(() => {
  if (canvasRef.value) {
    renderer = new DAGRenderer(canvasRef.value);
    render();
  }
});

// 深度监听树状态变化（变绿时立即重绘）
watch(() => props.diagnosticTree, render, { deep: true });

function render() {
  if (!renderer || !props.diagnosticTree) return;
  const graph = buildGraph(props.diagnosticTree, props.stepId);
  renderer.render(graph);
}
</script>
