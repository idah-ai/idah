import { describe, it, expect } from "vitest"
import { filtersToHash } from "./filtering"

describe("filtering", () => {
  it("#filterToHash (simple)", () => {
    expect(
      filtersToHash({
        "foo": "bar",
        "baz__gt": 1,
        "qux__lt": 2
      })
    ).toEqual({
      "foo": "bar",
      "baz__gt": 1,
      "qux__lt": 2
    })
  })

  it("#filterToHash (contains)", () =>{
    expect(
      filtersToHash({
        "foo__contains": ["bar", "boo"]
      })
    ).toEqual({
      "foo__contains": ["bar", "boo"]
    })
  })
})
