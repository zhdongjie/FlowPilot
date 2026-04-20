// src/sdk/__tests__/compiler/parser.test.ts

import { describe, it, expect } from "vitest";
import { FlowParser } from "../../compiler/parser"; // 👈 名字已更新

describe("FlowParser DSL v2", () => {

    it("should parse complex logic expressions", () => {
        const dsl = "a && (b || c)";
        const ast = FlowParser.parse(dsl); // 👈 方法已更新
        expect(ast.type).toBe("and");
    });

    it("should parse count functions", () => {
        const ast = FlowParser.parse("count(click, 3)");
        expect(ast).toEqual({ type: "event", key: "click", count: 3 });
    });

    it("should parse sequence functions with within", () => {
        const ast = FlowParser.parse("seq(login, buy, 1000)");
        expect(ast).toEqual({
            type: "sequence",
            keys: ["login", "buy"],
            within: 1000
        });
    });

    it("should combine logic and functions", () => {
        const dsl = "is_vip && count(buy, 2)";
        const ast = FlowParser.parse(dsl);
        expect(ast.type).toBe("and");
        // @ts-ignore
        expect(ast.conditions[1].count).toBe(2);
    });

    // 👉 额外赠送：V2 新语法的硬核测试
    it("should parse NOT and AFTER (v2 syntax)", () => {
        const ast = FlowParser.parse("!pay && after(step1)");
        expect(ast.type).toBe("and");
        // @ts-ignore
        expect(ast.conditions[0].type).toBe("not");
        // @ts-ignore
        expect(ast.conditions[0].condition.key).toBe("pay");
        // @ts-ignore
        expect(ast.conditions[1].type).toBe("after");
        // @ts-ignore
        expect(ast.conditions[1].stepId).toBe("step1");
    });

});
