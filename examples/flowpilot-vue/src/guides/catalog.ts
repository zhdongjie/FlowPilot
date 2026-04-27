import axios from "axios";
import type {
    FlowConfigOverride,
    GuideDefinition,
    GuideSource
} from "flowpilot";

import openAccountGuideDefinition from "./open-account-guide.json";

export type DemoGuideId = "open-account" | "profile-completion";
export type DemoGuideSourceKind = "static-json" | "mock-request";

export interface DemoGuideMeta {
    id: DemoGuideId;
    title: string;
    description: string;
    startLabel: string;
    sourceKind: DemoGuideSourceKind;
}

interface DemoGuideRegistration extends DemoGuideMeta {
    source: GuideSource;
    config?: FlowConfigOverride;
}

async function loadProfileGuideDefinition(): Promise<GuideDefinition> {
    const response = await axios.get<GuideDefinition>("/api/guides/profile-completion");
    return response.data;
}

const demoGuideCatalog: DemoGuideRegistration[] = [
    {
        id: "open-account",
        title: "开卡引导",
        description: "从本地静态 JSON 读取配置，适合版本内置型引导。",
        startLabel: "启动开卡引导",
        sourceKind: "static-json",
        source: openAccountGuideDefinition as GuideDefinition
    },
    {
        id: "profile-completion",
        title: "资料完善引导",
        description: "通过模拟请求拉取配置，后续可直接替换成真实接口。",
        startLabel: "启动资料完善引导",
        sourceKind: "mock-request",
        source: loadProfileGuideDefinition
    }
];

const demoGuideCatalogMap = new Map(
    demoGuideCatalog.map((guide) => [guide.id, guide] as const)
);

export function getDemoGuideMetaList(): DemoGuideMeta[] {
    return demoGuideCatalog.map(({ source, config, ...meta }) => ({ ...meta }));
}

export function getDemoGuideRegistration(id: DemoGuideId) {
    return demoGuideCatalogMap.get(id);
}
