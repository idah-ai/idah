// Grammar for property visibility conditions in the label editor.
//
// Input:  (properties.occluded = true) and (category match "vehicles/*")
// Output: ["and", [["eq", [["get", ["properties.occluded"]], true]],
//                  ["match", [["get", ["category"]], "vehicles/*"]]]]
//
// Every node is [operator, [args]]. Variables become ["get", [name]] and are
// read from the annotation value at runtime (see AstProcessor).
//
// Build: pnpm run build:parser (writes build/parser.js, imported as @build/parser.js)

// Surrounding whitespace is allowed, so error positions match the text as typed.
start = _ inner:expression _ { return inner }

// ─── Tokens ──────────────────────────────────────────────────────────────

_ "whitespace" = [ \t\n\r]*
digit = [0-9]
nonQuoteCharacter = [^"]
// Property ids are slugified labels, so they can contain "_" and "-".
identChar = [a-zA-Z0-9_-]
ParentIn = "("
ParentOut = ")"
// !identChar stops "or" from matching the start of a word such as "order".
Operator = op:("AND" / "OR" / "and" / "or") !identChar { return op }
StringQuotes = '"'

// Maps each comparison symbol to its AstProcessor operator name.
// contains any / all / none compare a multi-select value (a list) with a list.
comparisonOperator
  = "contains" [ \t\n\r]+ kind:("any" / "all" / "none") !identChar { return "has_" + kind }
  / op:("=" / "<=" / ">=" / "!=" / "<" / ">" / "in" / "match") {
    switch(op) {
      case '=': return 'eq'
      case '<=': return 'lte'
      case '>=': return 'gte'
      case '!=': return 'neq'
      case '<': return 'lt'
      case '>': return 'gt'
      case 'in': return 'in'
      case 'match': return 'match'
    }
  }

// ─── Expressions ─────────────────────────────────────────────────────────

expression = operatorExpr / comparisonExpr / parenExpr

baseExpr = comparisonExpr

// A literal is tried before a variable, so true/false are not read as names.
values = value / variable

// and / or have no precedence and group to the right:
// a and b or c  →  a and (b or c). Use parentheses to group otherwise.
operatorExpr
  = left:baseExpr _ op:Operator _ right:expression {
    return [op.toLowerCase(), [left, right]]
  }
  / left:parenExpr _ op:Operator _ right:expression {
    return [op.toLowerCase(), [left, right]]
  }

// Parentheses only group; they add no node to the AST.
parenExpr = ParentIn _ inner:expression _ ParentOut { return inner }

comparisonExpr
  = left:values _ op:comparisonOperator _ right:values {
    return [op, [left, right]]
  }

// ─── Values ──────────────────────────────────────────────────────────────

value = value:(Array / Integer / Boolean / string) { return value }

variable
  = variableName:variableName {
    return ["get", [variableName]]
  }

// Dotted path into the annotation value, e.g. category or properties.occlusion-level.
variableName = variableName:(variableSegment ("." (variableSegment))*) {
  return variableName[0] + variableName[1].map((arr) => arr.join("")).join("")
}

variableSegment = $identChar+

// Double quotes only. There is no escape for a quote inside a string.
string = StringQuotes stringValue:stringValue StringQuotes { return stringValue }

stringValue = stringChar:stringChar* { return stringChar.join("") }

stringChar = stringCharStart:nonQuoteCharacter stringCharEnd:(nonQuoteCharacter)* {
  return stringCharStart + stringCharEnd.join("")
}

// A list of strings or a list of integers, used with "in". Not empty, not mixed.
// Wrapped in an extra array so AstProcessor reads it as one literal, not a node.
Array
  = "[" _ head:string tail:(_ "," _ string)* _ "]" {
    return [[head, ...tail.map(arr => arr[3])]]
  }
  / "[" _ head:Integer tail:(_ "," _ Integer)* _ "]" {
    return [[head, ...tail.map(arr => arr[3])]]
  }

// !identChar keeps names such as trueColor readable as variables.
Boolean
  = "true" !identChar { return true }
  / "false" !identChar { return false }

// Whole numbers only: no sign, no decimals.
Integer = integer:digit+ { return parseInt(integer.join("")) }
