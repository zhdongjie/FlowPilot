// src/sdk/types/signal.ts

export type SignalType = "interaction" | "navigation" | "custom";

export interface Signal {
    id: string;

    key: string;

    type?: SignalType;

    timestamp: number;

    payload?: any; // 👉 支持业务自定义数据

    meta?: Record<string, any>;
}
