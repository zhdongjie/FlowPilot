// src/sdk/devtools/emitter.ts

export type Listener<T> = (event: T) => void;

export class EventEmitter<T> {
    private readonly listeners = new Set<Listener<T>>();

    // 订阅，并返回一个取消订阅的函数
    subscribe(fn: Listener<T>): () => void {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }

    // 广播事件
    emit(event: T) {
        for (const fn of this.listeners) {
            fn(event);
        }
    }

    // 清空监听器（防内存泄漏）
    clear() {
        this.listeners.clear();
    }
}
