import fs from "fs"
import path from "path"

const IGNORE_DIRS = new Set([
  "node_modules",
  ".svelte-kit",
  "build"
])

const IGNORE_FILES = new Set([
  ".DS_Store",
])

const IGNORE_EXT = new Set([])

export function shouldIgnore(filePath) {
  const name = path.basename(filePath)
  const ext = path.extname(name)

  if (IGNORE_DIRS.has(name)) return true
  if (IGNORE_FILES.has(name)) return true
  if (IGNORE_EXT.has(ext)) return true

  return false
}

export function replacePlaceholders(dir, replacements) {
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

export function toUnderscoreCase(str) {
  return str.replace(/-/g, "_")
}

export function kebabToPascal(str) {
  return str
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join("")
}