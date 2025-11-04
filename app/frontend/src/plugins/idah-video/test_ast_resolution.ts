type ASTValue = string | number | string[] | boolean | undefined;
type ASTNodeValue = ASTValue | [ASTValue] | ASTNode;
type SingleOperator = "get";
type MultiOperator = "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "and" | "or";
type ASTNode = [SingleOperator | MultiOperator, ASTNodeValue, ASTNodeValue];

const tree: ASTNode = [
  "or",
  ["eq", true, false],
  ["and", ["neq", ["eq", ["get", "var_1"], [["42", "24"]]], false], ["eq", "test", ["get", "var_2"]]],
];

const var_1: ASTValue = ["42", "24"];
const var_2: ASTValue = "test";
const variables: [string, ASTValue][] = [
  ["var_1", var_1],
  ["var_2", var_2],
];
const commands: (
  | [op: SingleOperator, (val: ASTValue) => ASTValue]
  | [op: MultiOperator, (val1: ASTValue, val2: ASTValue) => ASTValue]
)[] = [
  [
    "get",
    (val: ASTValue) => {
      const variable = variables.find(([k, _]) => val?.toString() == k);
      if (!variable) throw `no variable found ${val?.toString()}`;
      return variable[1];
    },
  ],
  [
    "eq",
    (val1: ASTValue, val2: ASTValue) => {
      if (val1 instanceof Array) {
        if (!(val2 instanceof Array)) return false;

        return val1.length == val2.length && val1.every((v) => val2.includes(v));
      }
      return val1 == val2;
    },
  ],
  [
    "neq",
    (val1: ASTValue, val2: ASTValue) => {
      return val1 != val2;
    },
  ],
  [
    "gt",
    (val1: ASTValue, val2: ASTValue) => {
      return val1 != undefined && val2 != undefined ? val1 > val2 : false;
    },
  ],
  [
    "lt",
    (val1: ASTValue, val2: ASTValue) => {
      return val1 != undefined && val2 != undefined ? val1 < val2 : false;
    },
  ],
  [
    "lte",
    (val1: ASTValue, val2: ASTValue) => {
      return val1 != undefined && val2 != undefined ? val1 <= val2 : false;
    },
  ],
  [
    "gte",
    (val1: ASTValue, val2: ASTValue) => {
      return val1 != undefined && val2 != undefined ? val1 >= val2 : false;
    },
  ],
  [
    "and",
    (val1: ASTValue, val2: ASTValue) => {
      return val1 == true && val2 == true;
    },
  ],
  [
    "or",
    (val1: ASTValue, val2: ASTValue) => {
      return val1 == true || val2 == true;
    },
  ],
];

function process_ast([command, val1, val2]: ASTNode) {
  return process_command(command, val1, val2) == true;
}

function process_command(command: string, val1: ASTNodeValue, val2?: ASTNodeValue): boolean | ASTValue {
  const cmd = commands.find((c) => c[0] == command)?.[1];

  if (!cmd) throw `no command ${command} found`;

  return cmd(process_value(val1), process_value(val2));
}

function process_value(value: ASTNodeValue): ASTValue {
  if (Array.isArray(value)) {
    const [command, val1, val2] = value;

    if (value.length == 1) return command;

    if (Array.isArray(command)) {
      console.warn("operator array received with value parameters", { value });
      return command;
    }

    if (command) return process_command(command.toString(), val1, val2);
    else return value as ASTValue;
  }

  return value;
}

export const ASTresult = process_ast(tree);
