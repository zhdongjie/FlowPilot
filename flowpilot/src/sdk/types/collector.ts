// flowpilot/src/sdk/types/collector.ts

/**
 * 统一的信号发射器签名
 */
export type EmitFunction = (signal: { key: string; meta?: Record<string, any> }) => void;

/**
 * 工业级适配器协议：任何第三方请求库接入 FlowPilot 必须实现此接口
 */
export interface NetworkAdapter {
    install(emit: EmitFunction): void;
}
