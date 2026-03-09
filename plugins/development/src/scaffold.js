import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const IGNORE_DIRS = new Set([
  "node_modules",
  ".svelte-kit",
  "build"
])

const IGNORE_FILES = new Set([
  ".DS_Store",
])

const IGNORE_EXT = new Set([])

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export async function createProject({ pluginName, pluginDisplayName, pluginDescription, pluginBackendServices }) {
  const pluginsDir = path.join(process.cwd(), "plugins")
  const targetDir = path.join(pluginsDir, pluginName)
  const templateDir = path.join(__dirname, "../_template")

  const allowBackendFiles = ["spec_helper.rb"]
  fs.cpSync(templateDir, targetDir, {
    recursive: true,
    filter: (src) => {
      const ignoreBackendService =
        src.includes("/backends/") &&
        allowBackendFiles.every(file => !src.endsWith(file)) &&
        (
          pluginBackendServices.length === 0 ||
          !pluginBackendServices.some(service => src.includes(`/backends/${service}`))
        )

      return !shouldIgnore(src) && !ignoreBackendService
    }
  })

  const pluginModule = kebabToPascal(pluginName)
  const pluginRubyFilename = toUnderscoreCase(pluginName)

  const replacements = {
    "{{pluginName}}": pluginName,
    "{{pluginDisplayName}}": pluginDisplayName,
    "{{pluginDescription}}": pluginDescription,
    "{{pluginModule}}": pluginModule,
    "{{pluginRubyFilename}}": pluginRubyFilename
  }

  renameFiles(targetDir, replacements)
  replacePlaceholders(targetDir, replacements)

  console.log("Plugin created:", targetDir)
}

function replacePlaceholders(dir, replacements) {
  const entries = fs.readdirSync(dir)

  for (const entry of entries) {
    const filePath = path.join(dir, entry)

    if (shouldIgnore(filePath)) continue

    const stat = fs.statSync(filePath)

    if (stat.isDirectory()) {
      replacePlaceholders(filePath, replacements)
      continue
    }

    let content = fs.readFileSync(filePath, "utf8")

    for (const key in replacements) {
      content = content.replaceAll(key, replacements[key])
    }

    fs.writeFileSync(filePath, content)
  }
}

export function renameFiles(dir, replacements) {
  const entries = fs.readdirSync(dir)

  for (const entry of entries) {
    const oldPath = path.join(dir, entry)
    const stat = fs.statSync(oldPath)

    if (stat.isDirectory()) {
      renameFiles(oldPath, replacements)
      continue
    }

    let newName = entry

    for (const key in replacements) {
      newName = newName.replaceAll(key, replacements[key])
    }

    if (newName !== entry) {
      const newPath = path.join(dir, newName)
      fs.renameSync(oldPath, newPath)
    }
  }
}

function toUnderscoreCase(str) {
  return str.replace(/-/g, "_")
}

function shouldIgnore(filePath) {
  const name = path.basename(filePath)
  const ext = path.extname(name)

  if (IGNORE_DIRS.has(name)) return true
  if (IGNORE_FILES.has(name)) return true
  if (IGNORE_EXT.has(ext)) return true

  return false
}

function kebabToPascal(str) {
  return str
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join("")
}