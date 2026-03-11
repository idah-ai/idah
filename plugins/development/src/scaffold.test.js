import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import fs from "fs"
import path from "path"
import { createProject, addBackendToPlugin } from "./scaffold.js"

// Test helper to clean up created test plugins
const cleanupTestPlugin = (pluginName) => {
  const pluginsDir = path.join(process.cwd(), "plugins")
  const testPluginDir = path.join(pluginsDir, pluginName)

  if (fs.existsSync(testPluginDir)) {
    fs.rmSync(testPluginDir, { recursive: true, force: true })
  }
}

describe("createProject", () => {
  const testPluginName = "test-plugin-temp"

  afterEach(() => {
    cleanupTestPlugin(testPluginName)
  })

  it("should create a plugin with basic structure", async () => {
    await createProject({
      pluginName: testPluginName,
      pluginDisplayName: "Test Plugin",
      pluginDescription: "A test plugin",
      pluginVersion: "0.0.1",
      pluginBackendServices: []
    })

    const pluginsDir = path.join(process.cwd(), "plugins")
    const pluginDir = path.join(pluginsDir, testPluginName)

    expect(fs.existsSync(pluginDir)).toBe(true)
    expect(fs.existsSync(path.join(pluginDir, "manifest.json"))).toBe(true)
    expect(fs.existsSync(path.join(pluginDir, "frontend"))).toBe(true)
    expect(fs.existsSync(path.join(pluginDir, "Gemfile"))).toBe(true)
  })

  it("should replace placeholders in manifest.json", async () => {
    await createProject({
      pluginName: testPluginName,
      pluginDisplayName: "Test Plugin Display",
      pluginDescription: "Amazing test description",
      pluginVersion: "1.2.3",
      pluginBackendServices: []
    })

    const pluginsDir = path.join(process.cwd(), "plugins")
    const manifestPath = path.join(pluginsDir, testPluginName, "manifest.json")
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"))

    expect(manifest.name).toBe(testPluginName)
    expect(manifest.title).toBe("Test Plugin Display")
    expect(manifest.description).toBe("Amazing test description")
  })

  it("should create backend services when specified", async () => {
    await createProject({
      pluginName: testPluginName,
      pluginDisplayName: "Test Plugin",
      pluginDescription: "A test plugin",
      pluginVersion: "0.0.1",
      pluginBackendServices: ["media", "sync"]
    })

    const pluginsDir = path.join(process.cwd(), "plugins")
    const backendsDir = path.join(pluginsDir, testPluginName, "backends")

    expect(fs.existsSync(path.join(backendsDir, "media"))).toBe(true)
    expect(fs.existsSync(path.join(backendsDir, "sync"))).toBe(true)
    expect(fs.existsSync(path.join(backendsDir, "spec_helper.rb"))).toBe(true)
  })

  it("should not create backend services when none specified", async () => {
    await createProject({
      pluginName: testPluginName,
      pluginDisplayName: "Test Plugin",
      pluginDescription: "A test plugin",
      pluginVersion: "0.0.1",
      pluginBackendServices: []
    })

    const pluginsDir = path.join(process.cwd(), "plugins")
    const backendsDir = path.join(pluginsDir, testPluginName, "backends")

    // Backend directory might exist but should not have media/sync subdirectories
    if (fs.existsSync(backendsDir)) {
      expect(fs.existsSync(path.join(backendsDir, "media"))).toBe(false)
      expect(fs.existsSync(path.join(backendsDir, "sync"))).toBe(false)
    }
  })

  it("should throw error if plugin already exists", async () => {
    // Create the plugin first
    await createProject({
      pluginName: testPluginName,
      pluginDisplayName: "Test Plugin",
      pluginDescription: "A test plugin",
      pluginVersion: "0.0.1",
      pluginBackendServices: []
    })

    // Mock process.exit to prevent test from exiting
    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called")
    })

    // Try to create again - should fail
    await expect(async () => {
      await createProject({
        pluginName: testPluginName,
        pluginDisplayName: "Test Plugin 2",
        pluginDescription: "Another test plugin",
        pluginVersion: "0.0.1",
        pluginBackendServices: []
      })
    }).rejects.toThrow("process.exit called")

    mockExit.mockRestore()
  })
})

describe("addBackendToPlugin", () => {
  const testPluginName = "test-plugin-backend"

  beforeEach(async () => {
    // Create a test plugin without backends
    await createProject({
      pluginName: testPluginName,
      pluginDisplayName: "Test Plugin",
      pluginDescription: "A test plugin",
      pluginVersion: "0.0.1",
      pluginBackendServices: []
    })
  })

  afterEach(() => {
    cleanupTestPlugin(testPluginName)
  })

  it("should add backend services to existing plugin", async () => {
    await addBackendToPlugin({
      pluginName: testPluginName,
      backendServices: ["media"]
    })

    const pluginsDir = path.join(process.cwd(), "plugins")
    const backendsDir = path.join(pluginsDir, testPluginName, "backends")

    expect(fs.existsSync(path.join(backendsDir, "media"))).toBe(true)
  })

  it("should add multiple backend services", async () => {
    await addBackendToPlugin({
      pluginName: testPluginName,
      backendServices: ["media", "sync"]
    })

    const pluginsDir = path.join(process.cwd(), "plugins")
    const backendsDir = path.join(pluginsDir, testPluginName, "backends")

    expect(fs.existsSync(path.join(backendsDir, "media"))).toBe(true)
    expect(fs.existsSync(path.join(backendsDir, "sync"))).toBe(true)
  })

  it("should skip existing backend services", async () => {
    // Add media backend first
    await addBackendToPlugin({
      pluginName: testPluginName,
      backendServices: ["media"]
    })

    // Try to add media again - should skip
    await addBackendToPlugin({
      pluginName: testPluginName,
      backendServices: ["media"]
    })

    const pluginsDir = path.join(process.cwd(), "plugins")
    const backendsDir = path.join(pluginsDir, testPluginName, "backends")

    // Should still exist and not throw error
    expect(fs.existsSync(path.join(backendsDir, "media"))).toBe(true)
  })

  it("should throw error if plugin does not exist", async () => {
    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called")
    })

    await expect(async () => {
      await addBackendToPlugin({
        pluginName: "non-existent-plugin",
        backendServices: ["media"]
      })
    }).rejects.toThrow("process.exit called")

    mockExit.mockRestore()
  })
})
