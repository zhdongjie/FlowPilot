// src/sdk/compiler/parser.ts

import type { Condition } from "../types";

type TokenType = 'AND' | 'OR' | 'LPAREN' | 'RPAREN' | 'COMMA' | 'IDENTIFIER' | 'NUMBER' | 'EOF';

interface Token {
    type: TokenType;
    value: string;
}

class Lexer {
    // 👈 修复：显式声明属性，不再使用参数属性简写
    private readonly input: string;
    private pos = 0;

    constructor(input: string) {
        this.input = input;
    }

    getNextToken(): Token {
        while (this.pos < this.input.length) {
            const char = this.input[this.pos];

            if (/\s/.test(char)) { this.pos++; continue; }
            if (char === '(') { this.pos++; return { type: 'LPAREN', value: '(' }; }
            if (char === ')') { this.pos++; return { type: 'RPAREN', value: ')' }; }
            if (char === ',') { this.pos++; return { type: 'COMMA', value: ',' }; }

            if (char === '&' && this.input[this.pos + 1] === '&') {
                this.pos += 2; return { type: 'AND', value: '&&' };
            }
            if (char === '|' && this.input[this.pos + 1] === '|') {
                this.pos += 2; return { type: 'OR', value: '||' };
            }

            if (/[0-9]/.test(char)) {
                const match = this.input.slice(this.pos).match(/^[0-9]+/);
                if (match) {
                    this.pos += match[0].length;
                    return { type: 'NUMBER', value: match[0] };
                }
            }

            const match = this.input.slice(this.pos).match(/^[a-zA-Z0-9_\-.]+/);
            if (match) {
                this.pos += match[0].length;
                return { type: 'IDENTIFIER', value: match[0] };
            }

            throw new Error(`[FlowCompiler] Unexpected char: ${char} at position ${this.pos}`);
        }
        return { type: 'EOF', value: '' };
    }
}

export class FlowCompiler {
    private lexer!: Lexer;
    private currentToken!: Token;

    /**
     * 入口方法：编译 DSL 字符串为 Condition AST
     */
    static compile(expr: string): Condition {
        const compiler = new FlowCompiler();
        compiler.lexer = new Lexer(expr);
        compiler.currentToken = compiler.lexer.getNextToken();
        const result = compiler.parseOr();

        if (compiler.currentToken.type !== 'EOF') {
            throw new Error(`[FlowCompiler] Unexpected token at end: ${compiler.currentToken.value}`);
        }
        return result;
    }

    private eat(type: TokenType) {
        if (this.currentToken.type === type) {
            this.currentToken = this.lexer.getNextToken();
        } else {
            throw new Error(`[FlowCompiler] Expected ${type} but got ${this.currentToken.type}`);
        }
    }

    private parseOr(): Condition {
        let node = this.parseAnd();
        while (this.currentToken.type === 'OR') {
            this.eat('OR');
            const right = this.parseAnd();
            // 优化：展平 OR 节点
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
            // 优化：展平 AND 节点
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

        throw new Error(`[FlowCompiler] Unexpected token: ${token.value}`);
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

        switch (name) {
            case 'count':
                return { type: 'event', key: args[0], count: parseInt(args[1], 10) };
            case 'within':
                return { type: 'event', key: args[0], within: parseInt(args[1], 10) };
            case 'seq': {
                // 如果最后一个参数是数字，将其作为 within
                const lastArg = args[args.length - 1];
                const hasTime = !isNaN(Number(lastArg));
                return {
                    type: 'sequence',
                    keys: hasTime ? args.slice(0, -1) : args,
                    within: hasTime ? parseInt(lastArg, 10) : undefined
                };
            }
            default:
                throw new Error(`[FlowCompiler] Unknown function: ${name}`);
        }
    }
}
