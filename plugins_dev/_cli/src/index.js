import prompts from "prompts"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { createProject, addBackendToPlugin } from "./scaffold.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Parse command line arguments
const args = process.argv.slice(2)
const command = args[0]
const subcommand = args[1]

// Get available backend services from template directory
function getAvailableBackendServices() {
  const templateDir = path.join(__dirname, "../_template")
  const backendsTemplateDir = path.join(templateDir, "backends")

  if (!fs.existsSync(backendsTemplateDir)) {
    return []
  }

  return fs.readdirSync(backendsTemplateDir)
    .filter(item => {
      const itemPath = path.join(backendsTemplateDir, item)
      return fs.statSync(itemPath).isDirectory()
    })
    .map(service => ({
      title: service.charAt(0).toUpperCase() + service.slice(1) + " Service",
      value: service
    }))
}

async function handleCreate() {
  const pluginName = subcommand

  if (!pluginName) {
    console.error("Error: Plugin name is required")
    console.log("Usage: idah-plugin create <plugin_name>")
    process.exit(1)
  }

  const displayNameResponse = await prompts({
    type: "text",
    name: "name",
    message: "Plugin display name",
    initial: pluginName
  })

  if (!displayNameResponse.name) {
    console.log("Operation cancelled")
    process.exit(0)
  }

  const descriptionResponse = await prompts({
    type: "text",
    name: "description",
    message: "Plugin description"
  })

  if (descriptionResponse.description === undefined) {
    console.log("Operation cancelled")
    process.exit(0)
  }

  const versionResponse = await prompts({
    type: "text",
    name: "version",
    message: "Plugin version",
    initial: "0.0.1"
  })

  if (versionResponse.version === undefined) {
    console.log("Operation cancelled")
    process.exit(0)
  }

  const servicesResponse = await prompts({
    type: "multiselect",
    name: "services",
    message: "Enable Service Backend(s) (optional)",
    choices: getAvailableBackendServices(),
    hint: "- Space to select. Return to submit (you can skip this for frontend-only plugins)"
  })

  // Allow empty array - frontend-only plugins are valid
  if (servicesResponse.services === undefined) {
    console.log("Operation cancelled")
    process.exit(0)
  }

  await createProject({
    pluginName,
    pluginDisplayName: displayNameResponse.name,
    pluginDescription: descriptionResponse.description,
    pluginVersion: versionResponse.version,
    pluginBackendServices: servicesResponse.services || []
  })
}

async function handleBackendAdd() {
  const pluginName = args[2]

  if (!pluginName) {
    console.error("Error: Plugin name is required")
    console.log("Usage: idah-plugin backend add <plugin_name>")
    process.exit(1)
  }

  const servicesResponse = await prompts({
    type: "multiselect",
    name: "services",
    message: "Select backend service(s) to add",
    choices: getAvailableBackendServices(),
    hint: "- Space to select. Return to submit"
  })

  if (servicesResponse.services === undefined || servicesResponse.services.length === 0) {
    console.log("No services selected. Operation cancelled")
    process.exit(0)
  }

  await addBackendToPlugin({
    pluginName,
    backendServices: servicesResponse.services
  })
}

function showHelp() {
  console.log(`
IDAH Plugin Generator

Usage:
  idah-plugin create <plugin_name>        Create a new plugin
  idah-plugin backend add <plugin_name>   Add backend service(s) to an existing plugin

Examples:
  idah-plugin create my-awesome-plugin
  idah-plugin backend add my-awesome-plugin

Commands:
  create <plugin_name>      Create a new plugin with the specified name.
                           You'll be prompted for display name, description,
                           and backend services to include (optional - you can
                           create frontend-only plugins).

  backend add <plugin_name> Add one or more backend services to an existing
                           plugin. You'll be prompted to select which
                           services to add (media, sync).

Options:
  -h, --help               Show this help message
  `)
}

// Main CLI dispatcher
async function main() {
  if (!command || command === "-h" || command === "--help") {
    showHelp()
    process.exit(0)
  }

  switch (command) {
    case "create":
      await handleCreate()
      break

    case "backend":
      if (subcommand === "add") {
        await handleBackendAdd()
      } else {
        console.error(`Error: Unknown backend subcommand "${subcommand}"`)
        console.log('Usage: idah-plugin backend add <plugin_name>')
        process.exit(1)
      }
      break

    default:
      console.error(`Error: Unknown command "${command}"`)
      showHelp()
      process.exit(1)
  }
}

main().catch((error) => {
  console.error("Error:", error.message)
  process.exit(1)
})
