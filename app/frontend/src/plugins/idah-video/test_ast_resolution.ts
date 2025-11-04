type ASTValue = string | number | string[] | boolean | undefined;
type ASTNodeValue = ASTValue | ASTNode | [ASTValue];
type ASTNode = [string, ASTNodeValue, ASTNodeValue?];

const tree: ASTNode = [
  "and",
  ["match", "*/vehicles", "categories/*"],
  ["and", ["neq", ["eq", ["get", "var_1"], [["42", "24"]]], false], ["eq", "test", ["get", "var_2"]]],
];

const var_1: ASTValue = ["42", "24"];
const var_2: ASTValue = "test";
const variables = new Map<string, ASTValue>([
  ["var_1", var_1],
  ["var_2", var_2],
]);

// Operator implementations
type UnaryOp = (val: ASTValue) => ASTValue;
type BinaryOp = (val1: ASTValue, val2: ASTValue) => ASTValue;

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

const operators = new Map<string, UnaryOp | BinaryOp>([
  [
    "match",
    (val1: ASTValue, val2: ASTValue) => {
      return wildcard_match(val1?.toString() || "", val2?.toString() || "");
    },
  ],
  [
    "get",
    (val: ASTValue): ASTValue => {
      const key = val?.toString();
      if (!key || !variables.has(key)) throw new Error(`Variable not found: ${key}`);
      return variables.get(key)!;
    },
  ],
  [
    "eq",
    (val1: ASTValue, val2: ASTValue): boolean => {
      if (Array.isArray(val1) && Array.isArray(val2)) {
        return val1.length === val2.length && val1.every((v) => val2.includes(v));
      }
      return val1 === val2;
    },
  ],
  [
    "neq",
    (val1: ASTValue, val2: ASTValue): boolean => {
      if (Array.isArray(val1) && Array.isArray(val2)) {
        return val1.length != val2.length || val1.some((v) => !val2.includes(v));
      }

      return val1 !== val2;
    },
  ],
  [
    "gt",
    (val1: ASTValue, val2: ASTValue): boolean => {
      return val1 != null && val2 != null ? val1 > val2 : false;
    },
  ],
  [
    "lt",
    (val1: ASTValue, val2: ASTValue): boolean => {
      return val1 != null && val2 != null ? val1 < val2 : false;
    },
  ],
  [
    "lte",
    (val1: ASTValue, val2: ASTValue): boolean => {
      return val1 != null && val2 != null ? val1 <= val2 : false;
    },
  ],
  [
    "gte",
    (val1: ASTValue, val2: ASTValue): boolean => {
      return val1 != null && val2 != null ? val1 >= val2 : false;
    },
  ],
  [
    "and",
    (val1: ASTValue, val2: ASTValue) => {
      return val1 === true && val2 === true;
    },
  ],
  [
    "or",
    (val1: ASTValue, val2: ASTValue) => {
      return val1 === true || val2 === true;
    },
  ],
]);

export function processAST(node: ASTNode): boolean {
  return processOperator(node) === true;
}

function processOperator(node: ASTNode): ASTValue {
  const [operator, val1, val2] = node;

  if (typeof operator !== "string") {
    throw new Error(`Invalid operator type: ${typeof operator}`);
  }

  const cmd = operators.get(operator);
  if (!cmd) throw new Error(`Operator not found: ${operator}`);

  return cmd(processValue(val1), processValue(val2));
}

function processValue(value: ASTNodeValue): ASTValue {
  if (!Array.isArray(value)) {
    return value;
  }

  const [first, ...rest] = value;

  // Single element array - treat as literal value
  if (rest.length === 0) {
    return Array.isArray(first) ? first : (value as ASTValue);
  }

  // Operator node
  if (typeof first === "string") {
    return processOperator(value as ASTNode);
  }

  // Array literal with nested arrays
  if (Array.isArray(first)) {
    console.warn("Operator array received with value parameters", { value });
    return first;
  }

  return value as ASTValue;
}

console.log("AST Result:", processAST(tree));
