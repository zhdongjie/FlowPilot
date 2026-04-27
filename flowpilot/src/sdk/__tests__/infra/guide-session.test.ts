import { afterEach, describe, expect, it, vi } from "vitest";
import {
    createGuideRegistryService,
    GuideSessionManager,
    createFlowPilotAsync,
    createFlowPilotFromDefinition
} from "../../index";
import type { FlowPlugin, GuideDefinition } from "../../types";

describe("Guide Session Layer", () => {
    const managers: GuideSessionManager[] = [];
    const controllers: Array<{ destroy: (options?: { clearCache?: boolean }) => void }> = [];

    const trackManager = (manager: GuideSessionManager) => {
        managers.push(manager);
        return manager;
    };

    const trackController = <T extends { destroy: (options?: { clearCache?: boolean }) => void }>(controller: T) => {
        controllers.push(controller);
        return controller;
    };

    afterEach(() => {
        while (managers.length > 0) {
            managers.pop()?.destroyCurrent({ clearCache: true });
        }

        while (controllers.length > 0) {
            controllers.pop()?.destroy({ clearCache: true });
        }

        localStorage.clear();
        document.body.innerHTML = "";
    });

    it("should derive a persistence key from definition id", () => {
        const controller = trackController(createFlowPilotFromDefinition({
            definition: {
                id: "guide.billing",
                rootStepId: "A",
                steps: [
                    { id: "A", when: "start" }
                ]
            }
        }));

        expect(controller.guideId).toBe("guide.billing");
        expect(controller.config.runtime.persistence.key).toBe("flowpilot:guide.billing");
    });

    it("should resolve an async guide source into a controller", async () => {
        const controller = trackController(await createFlowPilotAsync({
            source: async () => ({
                id: "guide.async",
                rootStepId: "A",
                steps: [
                    { id: "A", when: "start" }
                ]
            })
        }));

        expect(controller.guideId).toBe("guide.async");
        expect(controller.config.runtime.persistence.key).toBe("flowpilot:guide.async");
    });

    it("should destroy the previous guide when switching sessions", async () => {
        const manager = trackManager(new GuideSessionManager());

        const first = await manager.open({
            definition: {
                id: "guide.first",
                rootStepId: "A",
                steps: [{ id: "A", when: "start" }]
            },
            autoStart: false
        });

        expect(first).not.toBeNull();

        const destroySpy = vi.spyOn(first!, "destroy");

        const second = await manager.open({
            definition: {
                id: "guide.second",
                rootStepId: "B",
                steps: [{ id: "B", when: "next" }]
            },
            autoStart: false
        });

        expect(destroySpy).toHaveBeenCalledTimes(1);
        expect(second?.guideId).toBe("guide.second");
        expect(manager.getCurrentGuideId()).toBe("guide.second");
    });

    it("should ignore a stale async open once a newer guide wins the race", async () => {
        const manager = trackManager(new GuideSessionManager());
        const firstDefinition: GuideDefinition = {
            id: "guide.stale",
            rootStepId: "A",
            steps: [{ id: "A", when: "start" }]
        };
        let resolveFirst: ((definition: GuideDefinition) => void) | null = null;

        const firstOpen = manager.open({
            source: () => new Promise<GuideDefinition>(resolve => {
                resolveFirst = resolve;
            }),
            autoStart: false
        });

        const second = await manager.open({
            source: async () => ({
                id: "guide.latest",
                rootStepId: "B",
                steps: [{ id: "B", when: "finish" }]
            }),
            autoStart: false
        });

        expect(resolveFirst).not.toBeNull();
        resolveFirst!(firstDefinition);
        const stale = await firstOpen;

        expect(stale).toBeNull();
        expect(second?.guideId).toBe("guide.latest");
        expect(manager.getCurrentGuideId()).toBe("guide.latest");
    });

    it("should destroy a finished session and clear its derived persistence key when requested", async () => {
        const manager = trackManager(new GuideSessionManager());
        const definition: GuideDefinition = {
            id: "guide.reopenable",
            rootStepId: "A",
            steps: [{ id: "A", when: "start" }]
        };

        const first = await manager.open({
            definition,
            destroyOnComplete: true,
            clearCacheOnDestroy: true
        });

        expect(first).not.toBeNull();
        first!.runtime.dispatch({
            id: "start_1",
            key: "start",
            timestamp: 1000
        });

        expect(manager.getCurrent()).toBeNull();
        expect(localStorage.getItem("flowpilot:guide.reopenable")).toBeNull();
        expect(localStorage.getItem("flowpilot:guide.reopenable_finished")).toBeNull();

        const reopened = await manager.open({
            definition,
            autoStart: false
        });

        expect(reopened).not.toBeNull();
        expect(reopened!.runtime.activeSteps).toContain("A");
    });

    it("should open a guide by registry id and let user plugins override defaults by name", async () => {
        const calls: string[] = [];
        const defaultPlugin: FlowPlugin = {
            name: "plugin.test",
            onStart() {
                calls.push("default");
            }
        };
        const userPlugin: FlowPlugin = {
            name: "plugin.test",
            onStart() {
                calls.push("user");
            }
        };

        const registry = createGuideRegistryService({
            guides: [
                {
                    id: "guide.one",
                    source: {
                        id: "guide.one",
                        rootStepId: "A",
                        steps: [{ id: "A", when: "start" }]
                    }
                }
            ],
            plugins: [defaultPlugin],
            autoStart: false
        });

        const controller = await registry.open("guide.one", {
            plugins: [userPlugin],
            autoStart: false
        });

        expect(controller).not.toBeNull();
        controller!.start();

        expect(calls).toEqual(["user"]);
    });
});
