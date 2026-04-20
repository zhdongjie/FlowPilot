// src/sdk/compiler/parser.ts

import type { Condition } from "../types";

// V2 词法 Token 支持 'NOT'
type TokenType = 'AND' | 'OR' | 'NOT' | 'LPAREN' | 'RPAREN' | 'COMMA' | 'IDENTIFIER' | 'NUMBER' | 'EOF';

interface Token {
    type: TokenType;
    value: string;
}

class Lexer {
    private readonly input: string;
    private pos = 0;

    constructor(input: string) {
        this.input = input;
    }

    private skipWhitespace() {
        while (this.pos < this.input.length && /\s/.test(this.input[this.pos])) {
            this.pos++;
        }
    }

    private matchExact(str: string, type: TokenType): Token | null {
        if (this.input.startsWith(str, this.pos)) {
            this.pos += str.length;
            return { type, value: str };
        }
        return null;
    }

    private matchRegex(regex: RegExp, type: TokenType): Token | null {
        const match = this.input.slice(this.pos).match(regex);
        if (match) {
            this.pos += match[0].length;
            return { type, value: match[0] };
        }
        return null;
    }

    // 🌟 扁平化匹配，0 认知复杂度
    getNextToken(): Token {
        this.skipWhitespace();

        if (this.pos >= this.input.length) {
            return { type: 'EOF', value: '' };
        }

        const token =
            this.matchExact('&&', 'AND') ||
            this.matchExact('||', 'OR') ||
            this.matchExact('!', 'NOT') ||
            this.matchExact('(', 'LPAREN') ||
            this.matchExact(')', 'RPAREN') ||
            this.matchExact(',', 'COMMA') ||
            this.matchRegex(/^[0-9]+/, 'NUMBER') ||
            this.matchRegex(/^[a-zA-Z0-9_\-.]+/, 'IDENTIFIER');

        if (token) {
            return token;
        }

        throw new Error(`[FlowParser] Unexpected char: ${this.input[this.pos]} at position ${this.pos}`);
    }
}

export class FlowParser {
    private lexer!: Lexer;
    private currentToken!: Token;

    /**
     * 入口方法：解析 DSL 字符串为 Condition AST
     */
    static parse(expr: string): Condition {
        const parser = new FlowParser();
        parser.lexer = new Lexer(expr);
        parser.currentToken = parser.lexer.getNextToken();
        const result = parser.parseOr();

        if (parser.currentToken.type !== 'EOF') {
            throw new Error(`[FlowParser] Unexpected token at end: ${parser.currentToken.value}`);
        }
        return result;
    }

    private eat(type: TokenType) {
        if (this.currentToken.type === type) {
            this.currentToken = this.lexer.getNextToken();
        } else {
            throw new Error(`[FlowParser] Expected ${type} but got ${this.currentToken.type}`);
        }
    }

    private parseOr(): Condition {
        let node = this.parseAnd();
        while (this.currentToken.type === 'OR') {
            this.eat('OR');
            const right = this.parseAnd();
            if (node.type === 'or') {
                node.conditions.push(right);
            } else {
                node = { type: 'or', conditions: [node, right] };
            }
        }
        return node;
    }

    private parseAnd(): Condition {
        let node = this.parsePrimary();
        while (this.currentToken.type === 'AND') {
            this.eat('AND');
            const right = this.parsePrimary();
            if (node.type === 'and') {
                node.conditions.push(right);
            } else {
                node = { type: 'and', conditions: [node, right] };
            }
        }
        return node;
    }

    private parsePrimary(): Condition {
        const token = this.currentToken;

        // V2 逻辑非解析
        if (token.type === 'NOT') {
            this.eat('NOT');
            return {
                type: 'not',
                condition: this.parsePrimary()
            };
        }

        if (token.type === 'LPAREN') {
            this.eat('LPAREN');
            const node = this.parseOr();
            this.eat('RPAREN');
            return node;
        }

        if (token.type === 'IDENTIFIER') {
            const name = token.value;
            this.eat('IDENTIFIER');

            if (this.currentToken.type === 'LPAREN') {
                return this.parseFunction(name);
            }

            return { type: "event", key: name };
        }

        throw new Error(`[FlowParser] Unexpected token: ${token.value}`);
    }

    private parseFunction(name: string): Condition {
        this.eat('LPAREN');
        const args: string[] = [];

        while (this.currentToken.type !== 'RPAREN') {
            args.push(this.currentToken.value);
            this.eat(this.currentToken.type);
            if (this.currentToken.type === 'COMMA') {
                this.eat('COMMA');
            }
        }
        this.eat('RPAREN');

        // V2 业务函数映射
        switch (name) {
            case 'count':
                return { type: 'event', key: args[0], count: parseInt(args[1], 10) };
            case 'within':
                return { type: 'event', key: args[0], within: parseInt(args[1], 10) };
            case 'after':
                return { type: 'after', stepId: args[0] };
            case 'once':
                return { type: 'event', key: args[0], once: true };
            case 'seq': {
                const lastArg = args[args.length - 1];
                const hasTime = !isNaN(Number(lastArg));
                return {
                    type: 'sequence',
                    keys: hasTime ? args.slice(0, -1) : args,
                    within: hasTime ? parseInt(lastArg, 10) : undefined
                };
            }
            default:
                throw new Error(`[FlowParser] Unknown function: ${name}`);
        }
    }
}
