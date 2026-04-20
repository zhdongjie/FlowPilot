// src/sdk/guide/position.ts

export class PositionEngine {
    compute(rect: DOMRect, position: string = "bottom") {
        const gap = 12;
        // 假设气泡大致宽高，实际生产中可根据内容动态计算
        const tooltipW = 220;
        const tooltipH = 80;

        switch (position) {
            case "top":
                return { x: rect.left, y: rect.top - gap - tooltipH };
            case "right":
                return { x: rect.right + gap, y: rect.top };
            case "left":
                return { x: rect.left - gap - tooltipW, y: rect.top };
            case "bottom":
            default:
                return { x: rect.left, y: rect.bottom + gap };
        }
    }
}
