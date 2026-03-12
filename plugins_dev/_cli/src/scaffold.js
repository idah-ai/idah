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

export async function createProject({ pluginName, pluginDisplayName, pluginDescription, pluginVersion, pluginBackendServices }) {
  const targetDir = path.join(process.cwd(), pluginName)
  const templateDir = path.join(__dirname, "../_template")

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

  console.log("\n✓ Plugin created successfully!")
  console.log(`  Location: ./${pluginName}`)
  console.log(`  Name: ${pluginName}`)
  console.log(`  Display Name: ${pluginDisplayName}`)
  if (pluginBackendServices.length > 0) {
    console.log(`  Backend Services: ${pluginBackendServices.join(", ")}`)
  } else {
    console.log(`  Backend Services: none (frontend-only)`)
  }
  console.log("\nNext steps:")
  console.log(`  cd ${pluginName}`)
  console.log(`  # Start developing your plugin!`)
  console.log()
}

export async function addBackendToPlugin({ pluginName, backendServices }) {
  const pluginsDir = path.join(process.cwd(), "plugins")
  const targetDir = path.join(pluginsDir, pluginName)
  const templateDir = path.join(__dirname, "../_template")

  // Check if plugin exists
  if (!fs.existsSync(targetDir)) {
    console.error(`Error: Plugin "${pluginName}" does not exist at ${targetDir}`)
    console.log(`\nMake sure you're in the correct directory and the plugin exists.`)
    process.exit(1)
  }

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
