# Example Workflow Plugin

This is an example plugin that demonstrates how to create custom workflows for the dataset service using the IDAH plugin system.

## Overview

This plugin shows how to:

1. Define a workflow in the plugin manifest's `workflows` array
2. Register the workflow in the dataset service backend
3. Implement a custom workflow class with different annotation steps
4. Select the workflow explicitly when creating a dataset

## Structure

```
plugins/example-workflow/
├── manifest.json                    # Plugin manifest with modality and workflow definition
├── backends/
│   └── dataset/                     # Backend code for dataset service
│       └── example_workflow/
│           ├── dataset.rb          # Plugin initialization that registers the workflow
│           └── workflow/
│               └── custom_annotation_workflow.rb  # Custom workflow implementation
└── README.md                        # This file
```

## How It Works

### 1. Manifest Definition (manifest.json)

The manifest defines workflows in the `workflows` array:

```json
{
  "workflows": [
    {
      "name": "custom-annotation-workflow",
      "label": "Custom Annotation Workflow",
      "description": "A custom annotation workflow with multiple states"
    }
  ],
  "entryPoints": {
    "backend": {
      "module": "ExampleWorkflow",
      "path": "backends"
    }
  }
}
```

### 2. Plugin Initialization (backends/dataset/example_workflow/dataset.rb)

When the dataset service boots, it calls `ExampleWorkflow::Dataset.init(context)`:

```ruby
def self.init(context)
  context.register_workflow(
    "custom-annotation-workflow",
    class_name: "ExampleWorkflow::Workflow::CustomAnnotationWorkflow"
  )
end
```

### 3. Workflow Implementation

The custom workflow extends `Workflow::Base` and defines its own state machine with AASM:

```ruby
class CustomAnnotationWorkflow < ::Workflow::Base
  aasm do
    state :start, initial: true
    state :annotate
    state :review
    state :final_check
    state :done
    # ...
  end
end
```

### 4. Frontend Workflow Discovery

The frontend can query available workflows from all loaded plugins:

```
GET /plugins/workflows
```

Response:

```json
{
  "workflows": [
    {
      "name": "custom-annotation-workflow",
      "label": "Custom Annotation Workflow",
      "description": "A custom annotation workflow with multiple states",
      "plugin": "example-workflow"
    }
  ]
}
```

### 5. Dataset Creation with Workflow Selection

When creating a dataset, the `workflow_name` is explicitly specified:

```ruby
datasets.create({
  name: "My Dataset",
  modality: "example-modality",
  workflow_name: "custom-annotation-workflow",
  # ... other fields
})
```

**Important**: The user must explicitly choose a workflow when creating the dataset.

### 6. Workflow Lookup at Runtime

When an entry is submitted, the dataset's workflow_name determines which workflow to use:

```ruby
# In Dataset model (app/dataset/app/model/dataset.rb)
def entry_workflow
  # Looks up workflow by the dataset's workflow_name field
  Workflow::Registry.get(workflow_name)
end
```

If no `workflow_name` is specified or the workflow is not found, it falls back to `Workflow::SimpleReviewAnnotationWorkflow`.

## Workflow States

This example workflow has the following states:

1. **start** - Initial state
2. **annotate** - Annotation phase
3. **review** - Review phase
4. **final_check** - Final quality check phase
5. **done** - Completed
6. **error** - Error state

## Workflow Step Actions

Steps can define actions that appear as dropdown options in the frontend. Each action has a `name` (the key sent to the backend) and a `choices` array with the available options. Each choice explicitly specifies its boolean `value`, which is used as the value for the key when submitting.

### Action Structure

```ruby
# In the workflow definition's steps array:
{
  name: "review",
  label: "Review",
  description: "Review the annotation",
  actions: [
    {
      name: "approved",
      choices: [
        { label: "Approve",          icon: "SquareCheckIcon", value: true },
        { label: "Request Changes",  icon: "SquareXIcon",    value: false }
      ]
    }
  ]
}
```

- `name` - The key sent to the backend (e.g., `{ approved: true }`)
- `choices` - Array of available options for that key
  - `label` - Display text in the dropdown
  - `icon` - Optional icon component name (mapped to Lucide icons in the frontend)
  - `value` - The boolean value to send for this choice's key (explicit, not derived from position)

### Frontend Behavior

The `WorkflowStepActions` component reads the actions and choices:

- **Multiple choices**: Renders a dropdown menu. Each item calls `onSubmit({ [action.name]: choice.value })`
- **Single choice**: Renders a simple button that submits the single value
- **No actions**: Renders a simple submit button with no key/values

### Example: Review Step

The review step in this workflow defines one action (`approved`) with two choices:

| Choice          | Key sent   | Value   |
| --------------- | ---------- | ------- |
| Approve         | `approved` | `true`  |
| Request Changes | `approved` | `false` |

This produces `{ approved: true }` or `{ approved: false }` when submitted. The backend workflow's `approved?` method reads this value to determine the next state transition.

### Custom Definition File

The workflow step definitions live in `workflow/custom_annotation_definition.rb`. This class provides the step configuration that the frontend fetches via the API.

```ruby
def self.steps
  [
    { name: "start", label: "Start", description: "Entry is ready for annotation" },
    { name: "annotate", label: "Annotate", description: "Annotate the entry" },
    {
      name: "review",
      label: "Review",
      description: "Review the annotation",
      actions: [
        {
          name: "approved",
          choices: [
            { label: "Approve", icon: "SquareCheckIcon", value: true },
            { label: "Request Changes", icon: "SquareXIcon", value: false }
          ]
        }
      ]
    },
    {
      name: "final_check",
      label: "Final Check",
      description: "Final check before completion",
      actions: [
        {
          name: "final_approved",
          choices: [
            { label: "Approve Final Check",           icon: "SquareCheckIcon", value: true },
            { label: "Request Changes in Final Check", icon: "SquareXIcon",    value: false }
          ]
        }
      ]
    },
    { name: "done", label: "Done", description: "Annotation workflow completed" },
  ]
end
```

## Flow Diagram

```
start → annotate → review → final_check → done
                     ↑ ↓          ↓
                     annotate ← review
```

## Integration Points

### PluginLifecycleContext

The context provides the `register_workflow` method:

```ruby
def register_workflow(name, class_name:)
  Workflow::Registry.register(@plugin_name, name, class_name:)
end
```

### Workflow::Registry

The registry manages all registered workflows:

- `register(plugin_name, workflow_name, class_name:)` - Register a workflow
- `get(name)` - Get workflow class by name
- `list()` - List all registered workflow names
- `clear(plugin_name)` - Clear workflows registered by a plugin

## Testing

To use this plugin:

1. Place the plugin in the `plugins/` directory
2. Configure the plugin path in your dataset service configuration
3. Restart the dataset service
4. Query available workflows: `GET /dataset/workflows`
5. Create a dataset with `workflow_name: "custom-annotation-workflow"`
6. The custom workflow will be used for that dataset's entries

## Creating Your Own Workflow Plugin

1. Copy this example plugin structure
2. Update the manifest.json:
   - Set your plugin name, version, and description
   - Define workflows in the `workflows` array
   - Optionally define modalities if providing new annotation types
3. Implement your custom workflow class extending `Workflow::Base`
4. Define your states and transitions using AASM
5. Register your workflow in the `init` method using `context.register_workflow`
6. Deploy the plugin to the plugins directory
7. Restart the dataset service
8. Workflows will be available via `GET /dataset/workflows`

## Key Points

- **Workflows are independent**: They are declared in the manifest's `workflows` array, not tied to modalities
- **Explicit selection**: Users must explicitly select a `workflow_name` when creating a dataset
- **Discoverable**: Frontend can query available workflows from all plugins via the API
- **Flexible**: The same modality can be used with different workflows, and vice versa
- **Backward compatible**: Datasets without a `workflow_name` use the default workflow
