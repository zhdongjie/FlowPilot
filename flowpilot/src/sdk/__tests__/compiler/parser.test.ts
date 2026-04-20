import { describe, it, expect } from "vitest";
import { FlowCompiler } from "../../compiler/parser";

describe("FlowCompiler DSL v1", () => {

    it("should compile complex logic expressions", () => {
        const dsl = "a && (b || c)";
        const ast = FlowCompiler.compile(dsl);
        expect(ast.type).toBe("and");
    });

    it("should compile count functions", () => {
        const ast = FlowCompiler.compile("count(click, 3)");
        expect(ast).toEqual({ type: "event", key: "click", count: 3 });
    });

    it("should compile sequence functions with within", () => {
        const ast = FlowCompiler.compile("seq(login, buy, 1000)");
        expect(ast).toEqual({
            type: "sequence",
            keys: ["login", "buy"],
            within: 1000
        });
    });

    it("should combine logic and functions", () => {
        const dsl = "is_vip && count(buy, 2)";
        const ast = FlowCompiler.compile(dsl);
        expect(ast.type).toBe("and");
        // @ts-ignore
        expect(ast.conditions[1].count).toBe(2);
    });

});
