import prompts from "prompts"
import { createProject } from "./scaffold.js"

const pluginName = process.argv[2]

const displayNameResponse = await prompts({
  type: "text",
  name: "name",
  message: "Plugin display name"
})

const descriptionResponse = await prompts({
  type: "text",
  name: "description",
  message: "Plugin description"
})

const servicesResponse = await prompts({
  type: "multiselect",
  name: "services",
  message: "Enable Service Backend(s)",
  choices: [
    { title: "Media Service", value: "media" },
    { title: "Sync Service", value: "sync" }
  ]
})

await createProject({
  pluginName,
  pluginDisplayName: displayNameResponse.name,
  pluginDescription: descriptionResponse.description,
  pluginBackendServices: servicesResponse.services
})