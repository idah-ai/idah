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