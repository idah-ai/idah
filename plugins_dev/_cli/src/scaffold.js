import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

import {
  shouldIgnore,
  replacePlaceholders,
  renameFiles,
  toUnderscoreCase,
  kebabToPascal
} from "./util.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export async function createProject({ pluginName, pluginDisplayName, pluginDescription, pluginVersion, pluginBackendServices, outputPath }) {
  // Determine base directory - use outputPath if provided, otherwise current directory
  const baseDir = outputPath ? path.resolve(process.cwd(), outputPath) : process.cwd()
  const targetDir = path.join(baseDir, pluginName)
  const templateDir = path.join(__dirname, "../_template")

  // Create base directory if it doesn't exist
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true })
  }

  // Check if plugin already exists
  if (fs.existsSync(targetDir)) {
    console.error(`Error: Plugin "${pluginName}" already exists at ${targetDir}`)
    process.exit(1)
  }

  // Get available backend services from template directory
  const backendsTemplateDir = path.join(templateDir, "backends")
  const availableServices = fs.existsSync(backendsTemplateDir)
    ? fs.readdirSync(backendsTemplateDir).filter(item => {
        const itemPath = path.join(backendsTemplateDir, item)
        return fs.statSync(itemPath).isDirectory()
      })
    : []

  fs.cpSync(templateDir, targetDir, {
    recursive: true,
    filter: (src) => {
      // Check if this is a backend service folder that wasn't selected
      const isUnselectedBackendService = availableServices.some(service => {
        const servicePath = `/backends/${service}`
        return src.includes(servicePath) && !pluginBackendServices.includes(service)
      })

      return !shouldIgnore(src) && !isUnselectedBackendService
    }
  })

  const pluginModule = kebabToPascal(pluginName)
  const pluginRubyFilename = toUnderscoreCase(pluginName)

  const replacements = {
    "{{pluginName}}": pluginName,
    "{{pluginDisplayName}}": pluginDisplayName,
    "{{pluginDescription}}": pluginDescription,
    "{{pluginVersion}}": pluginVersion,
    "{{pluginModule}}": pluginModule,
    "{{pluginRubyFilename}}": pluginRubyFilename
  }

  renameFiles(targetDir, replacements)
  replacePlaceholders(targetDir, replacements)

  // Display relative path from current directory
  const relativePath = path.relative(process.cwd(), targetDir)
  const displayPath = relativePath.startsWith('..') ? targetDir : relativePath

  console.log("\n✓ Plugin created successfully!")
  console.log(`  Location: ${displayPath}`)
  console.log(`  Name: ${pluginName}`)
  console.log(`  Display Name: ${pluginDisplayName}`)
  if (pluginBackendServices.length > 0) {
    console.log(`  Backend Services: ${pluginBackendServices.join(", ")}`)
  } else {
    console.log(`  Backend Services: none (frontend-only)`)
  }
  console.log("\nNext steps:")
  console.log(`  cd ${displayPath}`)
  console.log(`  # Start developing your plugin!`)
  console.log()
}

export async function addBackendToPlugin({ pluginName, backendServices, pluginPath }) {
  const templateDir = path.join(__dirname, "../_template")

  // Use provided path as base directory, or default to current directory
  const baseDir = pluginPath ? path.resolve(process.cwd(), pluginPath) : process.cwd()
  const targetDir = path.join(baseDir, pluginName)

  // Check if plugin exists
  if (!fs.existsSync(targetDir)) {
    console.error(`Error: Plugin not found at "${targetDir}"`)
    console.log(`\nMake sure:`)
    console.log(`  1. The plugin exists at the specified location`)
    console.log(`  2. You're providing the correct base directory`)
    console.log(`\nUsage:`)
    console.log(`  idah-plugin backend add <plugin_name>              # looks for ./<plugin_name>`)
    console.log(`  idah-plugin backend add <plugin_name> <base_path>  # looks for <base_path>/<plugin_name>`)
    process.exit(1)
  }

  console.log(`\nFound plugin at: ${path.relative(process.cwd(), targetDir)}`)

  // Check if backends directory exists
  const backendsDir = path.join(targetDir, "backends")
  if (!fs.existsSync(backendsDir)) {
    fs.mkdirSync(backendsDir, { recursive: true })
  }

  const pluginModule = kebabToPascal(pluginName)
  const pluginRubyFilename = toUnderscoreCase(pluginName)

  const replacements = {
    "{{pluginName}}": pluginName,
    "{{pluginModule}}": pluginModule,
    "{{pluginRubyFilename}}": pluginRubyFilename
  }

  const addedServices = []
  const skippedServices = []

  // Copy each selected backend service
  for (const service of backendServices) {
    const sourceServiceDir = path.join(templateDir, "backends", service)
    const targetServiceDir = path.join(backendsDir, service)

    if (!fs.existsSync(sourceServiceDir)) {
      console.warn(`Warning: Backend template for "${service}" not found. Skipping.`)
      continue
    }

    if (fs.existsSync(targetServiceDir)) {
      console.log(`ℹ Backend "${service}" already exists. Skipping.`)
      skippedServices.push(service)
      continue
    }

    // Copy the service backend
    fs.cpSync(sourceServiceDir, targetServiceDir, {
      recursive: true,
      filter: (src) => !shouldIgnore(src)
    })

    // Rename files in the new backend
    renameFiles(targetServiceDir, replacements)

    // Replace placeholders in the new backend
    replacePlaceholders(targetServiceDir, replacements)

    addedServices.push(service)
  }

  // Also ensure spec_helper.rb exists in backends directory
  const specHelperSource = path.join(templateDir, "backends", "spec_helper.rb")
  const specHelperTarget = path.join(backendsDir, "spec_helper.rb")

  if (fs.existsSync(specHelperSource) && !fs.existsSync(specHelperTarget)) {
    fs.copyFileSync(specHelperSource, specHelperTarget)
  }

  // Display results
  console.log()
  if (addedServices.length > 0) {
    console.log("✓ Backend service(s) added successfully!")
    console.log(`  Plugin: ${pluginName}`)
    console.log(`  Services added: ${addedServices.join(", ")}`)
  }

  if (skippedServices.length > 0) {
    console.log(`  Services skipped (already exist): ${skippedServices.join(", ")}`)
  }

  if (addedServices.length === 0 && skippedServices.length === 0) {
    console.log("⚠ No backend services were added.")
  }

  console.log()
}
