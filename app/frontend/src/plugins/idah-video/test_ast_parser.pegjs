start = expression

_ "whitespace" = [ \t\n\r]*
digit = [0-9]
nonQuoteCharacter = [^"]
alphaNum = [a-zA-Z0-9]
ParentIn = "("
ParentOut = ")"
Operator = ("AND" / "OR" / "and" / "or")
StringQuotes = '"'
comparisonOperator
  = op:("=" / "<=" / ">=" / "!=" / "<" / ">" / "in" / "match") {
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

expression = operatorExpr / comparisonExpr / parenExpr

baseExpr = comparisonExpr

values = value / variable

operatorExpr
  = left:baseExpr _ op:Operator _ right:expression {
    return [op.toLowerCase(), [left, right]]
  }
  / left:parenExpr _ op:Operator _ right:expression {
    return [op.toLowerCase(), [left, right]]
  }

parenExpr = ParentIn _ inner:expression _ ParentOut { return inner }

comparisonExpr
  = left:values _ op:comparisonOperator _ right:values {
    return [op, [left, right]]
  }

value = value:(Array / Integer / string) { return value }

variable
  = variableName:variableName {
    return ["get", [variableName]]
  }

variableName = variableName:(variableSegment ("." (variableSegment))*) {
  return variableName[0] + variableName[1].map((arr) => arr.join("")).join("")
}

variableSegment = variableSegmentStart:alphaNum variableSegmentEnd:(alphaNum)* {
  return variableSegmentStart + variableSegmentEnd.join("")
}

string = StringQuotes stringValue:stringValue StringQuotes { return stringValue }

stringValue = stringChar:stringChar* { return stringChar.join("") }

stringChar = stringCharStart:nonQuoteCharacter stringCharEnd:(nonQuoteCharacter)* {
  return stringCharStart + stringCharEnd.join("")
}

Array
  = "[" inner:(string ("," _ (string))*) "]" {
    return [[inner[0], ...inner[1].map(arr => arr[2])]]
  }
  / "[" inner:(Integer ("," _ (Integer))*) "]" {
    return [[inner[0], ...inner[1].map(arr => arr[2])]]
  }

Integer = integer:digit+ { return parseInt(integer.join("")) }
