// src/sdk/utils/emitter.ts

export type Listener<T = void> = (event: T) => void;

export class EventEmitter<T = void> {
    private readonly listeners = new Set<Listener<T>>();

    /**
     * 订阅事件
     * @returns 返回一个取消订阅的函数 (Unsubscribe function)
     */
    subscribe(fn: Listener<T>): () => void {
        this.listeners.add(fn);
        return () => {
            this.listeners.delete(fn);
        };
    }

    /**
     * 触发事件广播
     */
    emit(event: T) {
        // 使用 Array.from 生成快照，防止在迭代过程中有监听器被增删导致死循环
        Array.from(this.listeners).forEach(fn => fn(event));
    }

    /**
     * 清理所有监听器 (用于内存回收)
     */
    clear() {
        this.listeners.clear();
    }
}
