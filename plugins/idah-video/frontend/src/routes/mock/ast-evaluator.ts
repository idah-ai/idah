// ---------------------------------------------------------------------------
// ast.ts — AST evaluator for conditional property visibility
// ---------------------------------------------------------------------------
//
// The labeling_configuration stores visibility rules as AST nodes:
//
//   visibility: boolean | ASTNode
//
// where ASTNode = [operator: string, args: ASTNodeValue[]]
//
// Supported operators:
//   get   – read a variable from the annotation value (unary)
//   eq    – equality (binary)
//   neq   – inequality (binary)
//   gt    – greater than (binary)
//   lt    – less than (binary)
//   gte   – greater or equal (binary)
//   lte   – less or equal (binary)
//   and   – logical and (binary)
//   or    – logical or (binary)
//   match – wildcard string matching (binary)
//   in    – value in array (binary)
// ---------------------------------------------------------------------------

import type { ASTNode } from "$idah/v2/types";

export type ASTValue = string | number | string[] | boolean | undefined;
export type ASTNodeValue = ASTValue | ASTNode | [ASTValue];

type OperatorCallback = (args: ASTValue[]) => ASTValue;

// ─── Wildcard matching ────────────────────────────────────────────────────

function wildcard_match(pattern1: string, pattern2: string): boolean {
  function matchHelper(i: number, j: number): boolean {
    if (i === pattern1.length && j === pattern2.length) return true;

    if (i === pattern1.length) {
      return pattern2.slice(j).split("").every((c) => c === "*");
    }
    if (j === pattern2.length) {
      return pattern1.slice(i).split("").every((c) => c === "*");
    }

    const c1 = pattern1[i];
    const c2 = pattern2[j];

    if (c1 === "*" && c2 === "*") {
      return matchHelper(i + 1, j) || matchHelper(i, j + 1) || matchHelper(i + 1, j + 1);
    } else if (c1 === "*") {
      return matchHelper(i + 1, j) || matchHelper(i, j + 1);
    } else if (c2 === "*") {
      return matchHelper(i, j + 1) || matchHelper(i + 1, j);
    } else if (c1 === c2) {
      return matchHelper(i + 1, j + 1);
    }
    return false;
  }
  return matchHelper(0, 0);
}

// ─── AstProcessor ─────────────────────────────────────────────────────────

export class AstProcessor {
  variables: Map<string, ASTValue>;

  constructor(variables: Map<string, ASTValue>) {
    this.variables = variables;
  }

  private operators = new Map<string, OperatorCallback>([
    [
      "match",
      (props) => {
        if (props.length !== 2) throw new Error(`Invalid number of arguments expected 2 received: ${props.length}`);
        return wildcard_match(props[0]?.toString() || "", props[1]?.toString() || "");
      },
    ],
    [
      "get",
      (props): ASTValue => {
        const [val] = props;
        const key = val?.toString();
        if (!key || !this.variables.has(key)) {
          console.warn(`Variable not found: ${key}`);
          return false;
        }
        return this.variables.get(key)!;
      },
    ],
    [
      "eq",
      (props) => {
        if (props.length !== 2) throw new Error(`Invalid number of arguments expected 2 received: ${props.length}`);
        const [val1, val2] = props;
        if (Array.isArray(val1) && Array.isArray(val2)) {
          return val1.length === val2.length && val1.every((v) => val2.includes(v));
        }
        return val1 === val2;
      },
    ],
    [
      "neq",
      (props) => {
        if (props.length !== 2) throw new Error(`Invalid number of arguments expected 2 received: ${props.length}`);
        const [val1, val2] = props;
        if (Array.isArray(val1) && Array.isArray(val2)) {
          return val1.length !== val2.length || val1.some((v) => !val2.includes(v));
        }
        return val1 !== val2;
      },
    ],
    [
      "gt",
      (props) => {
        if (props.length !== 2) throw new Error(`Invalid number of arguments expected 2 received: ${props.length}`);
        const [val1, val2] = props;
        return val1 != null && val2 != null ? (val1 as number) > (val2 as number) : false;
      },
    ],
    [
      "lt",
      (props) => {
        if (props.length !== 2) throw new Error(`Invalid number of arguments expected 2 received: ${props.length}`);
        const [val1, val2] = props;
        return val1 != null && val2 != null ? (val1 as number) < (val2 as number) : false;
      },
    ],
    [
      "lte",
      (props) => {
        if (props.length !== 2) throw new Error(`Invalid number of arguments expected 2 received: ${props.length}`);
        const [val1, val2] = props;
        return val1 != null && val2 != null ? (val1 as number) <= (val2 as number) : false;
      },
    ],
    [
      "gte",
      (props) => {
        if (props.length !== 2) throw new Error(`Invalid number of arguments expected 2 received: ${props.length}`);
        const [val1, val2] = props;
        return val1 != null && val2 != null ? (val1 as number) >= (val2 as number) : false;
      },
    ],
    [
      "and",
      (props) => {
        if (props.length !== 2) throw new Error(`Invalid number of arguments expected 2 received: ${props.length}`);
        return props[0] === true && props[1] === true;
      },
    ],
    [
      "or",
      (props) => {
        if (props.length !== 2) throw new Error(`Invalid number of arguments expected 2 received: ${props.length}`);
        return props[0] === true || props[1] === true;
      },
    ],
    [
      "in",
      (props) => {
        if (props.length !== 2) throw new Error(`Invalid number of arguments expected 2 received: ${props.length}`);
        const [val, list] = props;
        return Array.isArray(list) ? (list as ASTValue[]).includes(val) : false;
      },
    ],
  ]);

  /** Evaluate an AST node and return true/false. */
  processAST(node: ASTNode): boolean {
    return this.processOperator(node) === true;
  }

  private processOperator(node: ASTNode): ASTValue {
    const [operator, args] = node;
    if (typeof operator !== "string") {
      throw new Error(`Invalid operator type: ${typeof operator}`);
    }
    const cmd = this.operators.get(operator);
    if (!cmd) throw new Error(`Operator not found: ${operator}`);
    return cmd(args.map((a) => this.processValue(a)));
  }

  private processValue(value: ASTNodeValue): ASTValue {
    if (!Array.isArray(value)) {
      return value;
    }
    const [first, ...rest] = value;
    // Single-element array — unwrap
    if (rest.length === 0) {
      return first;
    }
    // Operator node
    if (typeof first === "string" && this.operators.has(first)) {
      return this.processOperator(value as ASTNode);
    }
    return value as ASTValue;
  }
}

/** Flatten a nested object into dot-separated variable entries. */
export function objectVariables(obj: object, root?: string): [string, ASTValue][] {
  return Object.entries(obj).reduce<[string, ASTValue][]>((acc, [k, v]) => {
    if (typeof v === "object" && !Array.isArray(v) && v !== null) {
      acc.push(...objectVariables(v, root ? `${root}.${k}` : k));
    } else {
      acc.push([root ? `${root}.${k}` : k, v as ASTValue]);
    }
    return acc;
  }, []);
}
