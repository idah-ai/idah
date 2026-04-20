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
  const outputPath = args[2] // Optional output path

  if (!pluginName) {
    console.error("Error: Plugin name is required")
    console.log("Usage: idah-plugin create <plugin_name> [output_path]")
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
    message: "Plugin description (optional)"
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
    pluginBackendServices: servicesResponse.services || [],
    outputPath
  })
}

async function handleBackendAdd() {
  const pluginName = args[2]
  const pluginPath = args[3] // Optional plugin path

  if (!pluginName) {
    console.error("Error: Plugin name is required")
    console.log("Usage: idah-plugin backend add <plugin_name> [plugin_path]")
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
    backendServices: servicesResponse.services,
    pluginPath
  })
}

function showHelp() {
  console.log(`
IDAH Plugin Generator

Usage:
  idah-plugin create <plugin_name> [output_path]       Create a new plugin
  idah-plugin backend add <plugin_name> [base_path]    Add backend service(s) to an existing plugin

Examples:
  idah-plugin create my-awesome-plugin                 Creates ./my-awesome-plugin
  idah-plugin create audio-plugin ./plugins            Creates ./plugins/audio-plugin
  idah-plugin backend add my-awesome-plugin            Looks for ./my-awesome-plugin
  idah-plugin backend add audio-plugin ./plugins       Looks for ./plugins/audio-plugin

Commands:
  create <plugin_name> [output_path]
                           Create a new plugin with the specified name.
                           Optional output_path specifies where to create the plugin
                           (default: current directory).
                           You'll be prompted for display name, description,
                           version, and backend services.

  backend add <plugin_name> [base_path]
                           Add one or more backend services to an existing
                           plugin. You'll be prompted to select which
                           services to add (media, sync).
                           Optional base_path specifies the directory containing the plugin
                           (default: current directory, looks for ./<plugin_name>).

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
