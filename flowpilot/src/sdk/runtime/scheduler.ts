// src/sdk/runtime/scheduler.ts

export interface TimerTask {
    ts: number;        // 触发时间（绝对时间）
    stepId: string;    // 属于哪个 step
    type: "timeout";   // 未来可扩展
}

/**
 * 最小堆调度器：确保 O(1) 获取最近的死线，O(log n) 插入
 */
export class TimerScheduler {
    private heap: TimerTask[] = [];

    push(task: TimerTask) {
        this.heap.push(task);
        this.bubbleUp(this.heap.length - 1);
    }

    peek(): TimerTask | null {
        return this.heap[0] || null;
    }

    pop(): TimerTask | null {
        if (this.heap.length === 0) return null;
        const top = this.heap[0];
        const last = this.heap.pop()!;
        if (this.heap.length > 0) {
            this.heap[0] = last;
            this.bubbleDown(0);
        }
        return top;
    }

    clear() {
        this.heap = [];
    }

    private bubbleUp(index: number) {
        while (index > 0) {
            const parent = (index - 1) >> 1;
            if (this.heap[index].ts >= this.heap[parent].ts) break;
            this.swap(index, parent);
            index = parent;
        }
    }

    private bubbleDown(index: number) {
        while (true) {
            let smallest = index;
            const left = 2 * index + 1;
            const right = 2 * index + 2;
            if (left < this.heap.length && this.heap[left].ts < this.heap[smallest].ts) smallest = left;
            if (right < this.heap.length && this.heap[right].ts < this.heap[smallest].ts) smallest = right;
            if (smallest === index) break;
            this.swap(index, smallest);
            index = smallest;
        }
    }

    private swap(i: number, j: number) {
        [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
    }
}
