// src/sdk/types/signal.ts

export type SignalType = "interaction" | "navigation" | "custom";

export interface Signal {
    id: string;

    key: string;

    type: SignalType;

    timestamp: number;
}
