import { describe, it, expect } from "vitest"
import {
  shouldIgnore,
  toUnderscoreCase,
  kebabToPascal
} from "./util.js"

describe("shouldIgnore", () => {
  it("should ignore node_modules directory", () => {
    expect(shouldIgnore("/path/to/node_modules")).toBe(true)
  })

  it("should ignore .svelte-kit directory", () => {
    expect(shouldIgnore("/path/to/.svelte-kit")).toBe(true)
  })

  it("should ignore build directory", () => {
    expect(shouldIgnore("/path/to/build")).toBe(true)
  })

  it("should ignore .DS_Store files", () => {
    expect(shouldIgnore("/path/to/.DS_Store")).toBe(true)
  })

  it("should not ignore regular files", () => {
    expect(shouldIgnore("/path/to/file.js")).toBe(false)
    expect(shouldIgnore("/path/to/src/index.js")).toBe(false)
  })

  it("should not ignore regular directories", () => {
    expect(shouldIgnore("/path/to/src")).toBe(false)
    expect(shouldIgnore("/path/to/components")).toBe(false)
  })
})

describe("toUnderscoreCase", () => {
  it("should convert kebab-case to snake_case", () => {
    expect(toUnderscoreCase("my-plugin")).toBe("my_plugin")
    expect(toUnderscoreCase("my-awesome-plugin")).toBe("my_awesome_plugin")
  })

  it("should handle single words", () => {
    expect(toUnderscoreCase("plugin")).toBe("plugin")
  })

  it("should handle multiple hyphens", () => {
    expect(toUnderscoreCase("my-very-long-plugin-name")).toBe("my_very_long_plugin_name")
  })
})

describe("kebabToPascal", () => {
  it("should convert kebab-case to PascalCase", () => {
    expect(kebabToPascal("my-plugin")).toBe("MyPlugin")
    expect(kebabToPascal("my-awesome-plugin")).toBe("MyAwesomePlugin")
  })

  it("should handle single words", () => {
    expect(kebabToPascal("plugin")).toBe("Plugin")
  })

  it("should capitalize each word", () => {
    expect(kebabToPascal("video-converter-pro")).toBe("VideoConverterPro")
  })

  it("should handle multiple hyphens", () => {
    expect(kebabToPascal("my-very-long-plugin-name")).toBe("MyVeryLongPluginName")
  })
})
