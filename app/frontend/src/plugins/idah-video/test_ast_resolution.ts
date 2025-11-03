const tree = [
  "or",
  ["eq", true, false],
  ["and", ["neq", ["eq", ["get", "var_1"], [42]], false], ["eq", "test", ["get", "var_2"]]],
];
const var_1 = [42];
const var_2 = "test";
const variables = [
  ["var_1", var_1],
  ["var_2", var_2],
];
const commands = [
  [
    "get",
    (val) => {
      const variable = variables.find(([k, _]) => val?.toString() == k);
      if (!variable) throw `no variable found ${val?.toString()}`;
      return variable[1];
    },
  ],
  [
    "eq",
    (val1, val2) => {
      if (val1 instanceof Array) {
        if (!(val2 instanceof Array)) return false;

        return val1.length == val2.length && val1.every((v) => val2.includes(v));
      }
      return val1 == val2;
    },
  ],
  [
    "neq",
    (val1, val2) => {
      return val1 != val2;
    },
  ],
  [
    "gt",
    (val1, val2) => {
      return val1 != undefined && val2 != undefined ? val1 > val2 : false;
    },
  ],
  [
    "lt",
    (val1, val2) => {
      return val1 != undefined && val2 != undefined ? val1 < val2 : false;
    },
  ],
  [
    "lte",
    (val1, val2) => {
      return val1 != undefined && val2 != undefined ? val1 >= val2 : false;
    },
  ],
  [
    "gte",
    (val1, val2) => {
      return val1 != undefined && val2 != undefined ? val1 <= val2 : false;
    },
  ],
  [
    "and",
    (val1, val2) => {
      return val1 == true && val2 == true;
    },
  ],
  [
    "or",
    (val1, val2) => {
      return val1 == true || val2 == true;
    },
  ],
];

function process_ast(ast) {
  return process_command(ast) == true;
}

function process_command([command, val1, val2]) {
  const cmd = commands.find((c) => c[0] == command)?.[1];

  if (!cmd) throw `no command ${command} found`;

  return cmd(process_value(val1), process_value(val2));
}

function process_value(value) {
  if (value instanceof Array) {
    let command, val1, val2;
    switch (value.length) {
      case 1:
        if (value[0] instanceof Array) return value[0];
        break;
      case 2:
        [command, val1] = value;
        return process_command([command, val1]);
      case 3:
        [command, val1, val2] = value;
        return process_command([command, val1, val2]);
      default:
        throw `expected 1..3 arguments found ${value.length}`;
    }
  }

  return value;
}

console.log(process_ast(tree));
