// src/sdk/guide/controller.ts
import { FlowRuntime } from "../runtime/runtime";
import { BehaviorCollector } from "../collector/collector";
import { GuideOrchestrator } from "./orchestrator";
import type { GuideStep, NetworkAdapter} from "../types";
import {FlowParser} from "../compiler/parser";


export class GuideController {
    public readonly runtime: FlowRuntime;
    public readonly collector: BehaviorCollector;
    private readonly orchestrator: GuideOrchestrator;

    constructor(options: {
        steps: GuideStep[];
        rootStepId: string;
        networkAdapters?: NetworkAdapter[]
    }) {
        const compiledSteps = options.steps.map(step => {
            const parsed = { ...step };
            if (typeof parsed.when === 'string') parsed.when = FlowParser.parse(parsed.when);
            if (typeof parsed.enterWhen === 'string') parsed.enterWhen = FlowParser.parse(parsed.enterWhen);
            if (typeof parsed.cancelWhen === 'string') parsed.cancelWhen = FlowParser.parse(parsed.cancelWhen);
            return parsed;
        });

        this.runtime = new FlowRuntime({ steps: compiledSteps, rootStepId: options.rootStepId });

        // 传入适配器给采集层
        this.collector = new BehaviorCollector(this.runtime, options.networkAdapters);
        this.orchestrator = new GuideOrchestrator(this.runtime, compiledSteps);
    }

    start() {
        this.collector.mount();
        this.orchestrator.start();
        this.runtime.start();

        // 初始自启信号
        if (this.runtime.activeSteps.length === 0) {
            this.runtime.dispatch({
                id: `init_${Date.now()}`,
                key: "start",
                timestamp: Date.now()
            });
        }
    }

    stop() {
        this.orchestrator.stop();
        this.runtime.stop();
    }
}
