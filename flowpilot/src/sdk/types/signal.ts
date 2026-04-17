// src/sdk/types/signal.ts
export type SignalType = "interaction" | "navigation" | "custom";

export type SignalMode = "event" | "fact";

export interface Signal {
    id: string;

    key: string;

    type: SignalType;

    mode: SignalMode;

    timestamp: number;
}
