export type ASTValue = string | number | string[] | boolean | undefined;
export type ASTNodeValue = ASTValue | ASTNode | [ASTValue];
export type ASTNode = [string, ASTNodeValue[]];

// Operator implementations
type OperatorCallback = (args: ASTValue[]) => ASTValue;

function wildcard_match(pattern1: string, pattern2: string) {
  function matchHelper(i: number, j: number): boolean {
    // Base case: both patterns exhausted
    if (i === pattern1.length && j === pattern2.length) {
      return true;
    }

    // If one pattern is exhausted, check if remaining is all '*'
    if (i === pattern1.length) {
      return pattern2
        .slice(j)
        .split("")
        .every((c) => c === "*");
    }

    if (j === pattern2.length) {
      return pattern1
        .slice(i)
        .split("")
        .every((c) => c === "*");
    }

    const c1 = pattern1[i];
    const c2 = pattern2[j];

    if (c1 === "*" && c2 === "*") {
      // Both are wildcards - they can match any sequence
      return matchHelper(i + 1, j) || matchHelper(i, j + 1) || matchHelper(i + 1, j + 1);
    } else if (c1 === "*") {
      // pattern1 has wildcard - can match 0 or more characters from pattern2
      return matchHelper(i + 1, j) || matchHelper(i, j + 1);
    } else if (c2 === "*") {
      // pattern2 has wildcard - can match 0 or more characters from pattern1
      return matchHelper(i + 1, j) || matchHelper(i, j + 1);
    } else if (c1 === c2) {
      // Exact character match
      return matchHelper(i + 1, j + 1);
    } else {
      // Characters don't match and no wildcards
      return false;
    }
  }

  return matchHelper(0, 0);
}

export class AstProcessor {
  variables: Map<string, ASTValue>;

  constructor(variables: Map<string, ASTValue>) {
    this.variables = variables;
  }

  operators = new Map<string, OperatorCallback>([
    [
      "match",
      (props) => {
        if (props.length != 2) throw new Error(`Invalid number of arguments expected 2 received: ${props.length}`);

        const [val1, val2] = props;

        console.debug({
          op: "match",
          val1,
          val2,
          result: wildcard_match(val1?.toString() || "", val2?.toString() || ""),
        });

        return wildcard_match(val1?.toString() || "", val2?.toString() || "");
      },
    ],
    [
      "get",
      (props): ASTValue => {
        const [val] = props;
        const key = val?.toString();
        if (!key || !this.variables.has(key)) {
          console.warn({ op: "get", val, key, variables: this.variables });
          console.warn(`Variable not found: ${key}`);
          return false;
        }
        console.debug({ op: "get", val, result: this.variables.get(key) });
        return this.variables.get(key)!;
      },
    ],
    [
      "eq",
      (props) => {
        if (props.length != 2) throw new Error(`Invalid number of arguments expected 2 received: ${props.length}`);

        const [val1, val2] = props;

        console.debug({
          op: "eq",
          val1,
          val2,
          result:
            Array.isArray(val1) && Array.isArray(val2)
              ? val1.length === val2.length && val1.every((v) => val2.includes(v))
              : val1 === val2,
        });

        if (Array.isArray(val1) && Array.isArray(val2)) {
          return val1.length === val2.length && val1.every((v) => val2.includes(v));
        }
        return val1 === val2;
      },
    ],
    [
      "neq",
      (props) => {
        if (props.length != 2) throw new Error(`Invalid number of arguments expected 2 received: ${props.length}`);

        const [val1, val2] = props;

        console.debug({
          op: "neq",
          val1,
          val2,
          result:
            Array.isArray(val1) && Array.isArray(val2)
              ? val1.length != val2.length || val1.some((v) => !val2.includes(v))
              : val1 !== val2,
        });

        if (Array.isArray(val1) && Array.isArray(val2)) {
          return val1.length != val2.length || val1.some((v) => !val2.includes(v));
        }

        return val1 !== val2;
      },
    ],
    [
      "gt",
      (props) => {
        if (props.length != 2) throw new Error(`Invalid number of arguments expected 2 received: ${props.length}`);

        const [val1, val2] = props;
        console.debug({
          op: "gt",
          val1,
          val2,
          result: val1 != null && val2 != null ? val1 > val2 : false,
        });

        return val1 != null && val2 != null ? val1 > val2 : false;
      },
    ],
    [
      "lt",
      (props) => {
        if (props.length != 2) throw new Error(`Invalid number of arguments expected 2 received: ${props.length}`);

        const [val1, val2] = props;
        console.debug({
          op: "lt",
          val1,
          val2,
          result: val1 != null && val2 != null ? val1 < val2 : false,
        });
        return val1 != null && val2 != null ? val1 < val2 : false;
      },
    ],
    [
      "lte",
      (props) => {
        if (props.length != 2) throw new Error(`Invalid number of arguments expected 2 received: ${props.length}`);

        const [val1, val2] = props;
        console.debug({
          op: "lte",
          val1,
          val2,
          result: val1 != null && val2 != null ? val1 <= val2 : false,
        });

        return val1 != null && val2 != null ? val1 <= val2 : false;
      },
    ],
    [
      "gte",
      (props) => {
        if (props.length != 2) throw new Error(`Invalid number of arguments expected 2 received: ${props.length}`);

        const [val1, val2] = props;
        console.debug({
          op: "lte",
          val1,
          val2,
          result: val1 != null && val2 != null ? val1 >= val2 : false,
        });
        return val1 != null && val2 != null ? val1 >= val2 : false;
      },
    ],
    [
      "and",
      (props) => {
        if (props.length != 2) throw new Error(`Invalid number of arguments expected 2 received: ${props.length}`);

        const [val1, val2] = props;
        console.debug({
          op: "and",
          val1,
          val2,
          result: val1 === true && val2 === true,
        });
        return val1 === true && val2 === true;
      },
    ],
    [
      "or",
      (props) => {
        if (props.length != 2) throw new Error(`Invalid number of arguments expected 2 received: ${props.length}`);

        const [val1, val2] = props;
        console.debug({
          op: "and",
          val1,
          val2,
          result: val1 === true || val2 === true,
        });
        return val1 === true || val2 === true;
      },
    ],
  ]);

  processAST(node: ASTNode): boolean {
    const result = this.processOperator(node) === true;
    console.debug(ASTNodeToFunctionString(node), { result });
    return result;
  }

  processOperator(node: ASTNode): ASTValue {
    const [operator, args] = node;

    if (typeof operator !== "string") {
      throw new Error(`Invalid operator type: ${typeof operator}`);
    }

    const cmd = this.operators.get(operator);
    if (!cmd) throw new Error(`Operator not found: ${operator}`);

    return cmd(args.map((a) => this.processValue(a)));
  }

  processValue(value: ASTNodeValue): ASTValue {
    if (!Array.isArray(value)) {
      return value;
    }

    const [first, ...rest] = value;

    // Single element array - treat as literal value
    if (rest.length === 0) {
      return first;
      // return Array.isArray(first) ? first : (value as ASTValue);
    }

    // Operator node
    if (typeof first === "string") {
      return this.processOperator(value as ASTNode);
    }

    // Array literal with nested arrays
    if (Array.isArray(first)) {
      console.warn("Operator array received with value parameters", { value });
      return first;
    }

    return value as ASTValue;
  }
}

export function objectVariables(obj: object, root?: string) {
  return Object.entries(obj).reduce((acc: [string, ASTValue][], [k, v]) => {
    console.log({ k, v, type: typeof v });
    if (typeof v === "object" && !Array.isArray(v)) {
      acc = acc.concat(objectVariables(v, root ? [root, k].join(".") : k));
    } else {
      acc.push([root ? [root, k].join(".") : k, v]);
    }
    return acc;
  }, []);
}

import parser from "../../../build/parser.cjs";

const _variables = {
  var1: ["42", "24"],
  var2: "categories/*",
  var3: true,
  false: false,
  true: true,
  deep: { test: 42, deeper: { test2: "42", boolean: false } },
};

// easiear to read than the array \_o_/
function ASTNodeToFunctionString(node: ASTNode, d = 0): string {
  return `${node?.[0]}(${node?.[1].map((n) => ASTNodeValueToString(n, d + 1)).join(", ")})`;
}
function ASTNodeValueToString(value: ASTNodeValue, d: number) {
  if (Array.isArray(value) && typeof value[0] == "string" && Array.isArray(value[1]))
    return `\n${Array(d).fill(" ").join("")}${ASTNodeToFunctionString(value as ASTNode, d)}`;
  else if (Array.isArray(value)) return `[${value}]`;
  else if (typeof value == "string") return `"${value}"`;
  return value;
}

try {
  const query =
    'var3 = false or (var1 = ["42", "24"] and var2 match "*/vehicles" and deep.test != 42 or deep.deeper.boolean = false)';
  const result = parser.parse(query);
  console.debug("Parse successful:", ASTNodeToFunctionString(result), { result });
  const variables = objectVariables(_variables);
  console.debug({ variables });
  console.log("AST Result:", new AstProcessor(new Map<string, ASTValue>(variables)).processAST(result));
} catch (error) {
  console.error("Parse error:", error.message);
  // The error object has useful properties for detailed reporting,
  // such as location, expected, found, etc.
}
