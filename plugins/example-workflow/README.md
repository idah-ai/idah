# Example Workflow Plugin

This is an example plugin that demonstrates how to create custom workflows for the dataset service using the IDAH plugin system.

## Overview

This plugin shows how to:

1. Define a workflow in the plugin manifest for a specific modality
2. Register the workflow in the dataset service
3. Implement a custom workflow class with different annotation steps

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

The manifest defines a modality with an associated workflow:

```json
{
  "modalities": [
    {
      "id": "example-modality",
      "label": "Example Modality",
      "workflow": "custom-annotation-workflow"
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

### 4. Usage in Dataset

When a dataset is created with `modality: "example-modality"`, the workflow is automatically selected:

```ruby
# In Dataset model (app/dataset/app/model/dataset.rb)
def entry_workflow
  # Looks up workflow by modality from plugin manifest
  Workflow::Registry.get_by_modality_or_default(modality)
end
```

If no plugin provides a workflow for the modality, it falls back to `Workflow::SimpleReviewAnnotationWorkflow`.

## Workflow States

This example workflow has the following states:

1. **start** - Initial state
2. **annotate** - Annotation phase
3. **review** - Review phase
4. **final_check** - Final quality check phase
5. **done** - Completed
6. **error** - Error state

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
- `get(name)` - Get workflow by name
- `get_by_modality(modality)` - Get workflow by modality (from manifest)
- `get_by_modality_or_default(modality)` - Get workflow or default

## Testing

To use this plugin:

1. Place the plugin in the `plugins/` directory
2. Configure the plugin path in your dataset service configuration
3. Restart the dataset service
4. Create a dataset with `modality: "example-modality"`
5. The custom workflow will be automatically used for that dataset's entries

## Creating Your Own Workflow Plugin

1. Copy this example plugin structure
2. Update the manifest.json with your plugin name and modality
3. Implement your custom workflow class extending `Workflow::Base`
4. Define your states and transitions using AASM
5. Register your workflow in the init method
6. Deploy the plugin to the plugins directory
