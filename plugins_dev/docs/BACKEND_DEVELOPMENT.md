# Backend Development Guide

This guide covers backend development for IDAH plugins using Ruby.

## Overview

IDAH plugins can have backend services that process media files, export data, or integrate with external systems. Backend services are written in Ruby and follow a modular structure.

**Technology Stack:**
- **Language**: Ruby 3.4+
- **Testing Framework**: RSpec
- **Schema Validation**: Verse Schema
- **Dependencies**: Bundler

## File Structure

```
backends/
├── README.md             # Backend quick start guide
├── spec_helper.rb        # Shared RSpec configuration
├── .rspec                # RSpec configuration
├── media/                # Media service (if enabled)
│   └── <plugin_name_underscore>/
│       ├── media.rb          # Media service module (registers processor)
│       ├── media_spec.rb     # Media service tests
│       ├── processor.rb      # Core processing logic
│       ├── processor_spec.rb # Processor tests
│       ├── options.rb        # Options schema and validation
│       └── options_spec.rb   # Options tests
└── sync/                 # Sync service (if enabled)
    └── <plugin_name_underscore>/
        ├── sync.rb           # Sync service module (registers exporter)
        ├── sync_spec.rb      # Sync service tests
        ├── export.rb         # Export/sync logic
        └── export_spec.rb    # Export tests
```

**Note:** `<plugin_name_underscore>` is your plugin name in snake_case (e.g., `my_awesome_plugin` for plugin `my-awesome-plugin`).

## Available Backend Services

IDAH plugins can include **one, all, or none** of these backend services. You can create frontend-only plugins, or add backend services as needed.

### Media Service

Handles media file processing (images, videos, audio, etc.). Process original media files and generate thumbnails, previews, or transformations.

**[→ Read the Media Service Guide](backends/MEDIA_SERVICE.md)**

### Sync Service

Handles data export and synchronization with external systems. Export datasets, entries, annotations, and media to various formats or external APIs.

**[→ Read the Sync Service Guide](backends/SYNC_SERVICE.md)**

## Testing

### Using RSpec

All backend code should have comprehensive tests:

```ruby
# frozen_string_literal: true

require "spec_helper"
require_relative "processor"

RSpec.describe YourPlugin::Processor do
  describe "#process" do
    it "processes media correctly" do
      options = YourPlugin::Options.new(quality: 90)
      processor = described_class.new(options)

      context = double("context",
        input_file: "input.jpg",
        output_file: "output.webp"
      )

      expect { processor.process(context) }.not_to raise_error
    end
  end
end
```

### Running Tests

```bash
# Run all tests
bundle exec rspec

# Run specific file
bundle exec rspec spec/processor_spec.rb

# Run with coverage
bundle exec rspec --format documentation
```

## Best Practices

### 1. Module Naming

- Use nested classes (`YourPlugin::Media`, `YourPlugin::Sync`) to avoid Zeitwerk conflicts
- Follow Ruby naming conventions (PascalCase for classes, snake_case for files)

### 2. Error Handling

```ruby
def process(context)
  raise ArgumentError, "Input file required" unless context.input_file

  begin
    # Processing logic
  rescue StandardError => e
    Verse.logger.error("Processing failed: #{e.message}")
    raise
  end
end
```

### 3. Logging

```ruby
def process(context)
  Verse.logger.info("Starting processing for #{context.input_file}")
  # ... processing
  Verse.logger.info("Processing complete")
end
```

### 4. Performance

- Process files in batches when possible
- Use background jobs for long-running tasks
- Clean up temporary files

### 5. Security

- Validate all input options
- Sanitize file paths
- Use safe file operations
- Don't expose sensitive data in logs

## Debugging

### Enable Debug Logging

```ruby
Verse.logger.level = Logger::DEBUG
```

### Use Pry for Debugging

```ruby
require "pry"

def process(context)
  binding.pry  # Debugger breakpoint
  # ... rest of code
end
```

## Common Patterns

### Media Processing Pipeline

```ruby
def process(context)
  validate_input(context.input_file)

  temp_file = create_temp_file

  begin
    transform(context.input_file, temp_file)
    optimize(temp_file, context.output_file)
  ensure
    cleanup(temp_file)
  end
end
```

### Batch Export

```ruby
def export(context)
  entries = fetch_entries(context.dataset)

  entries.each_slice(100) do |batch|
    export_batch(batch)
  end
end
```

## Resources

- [Ruby Documentation](https://ruby-doc.org/)
- [RSpec Documentation](https://rspec.info/)
- [Verse Framework](https://github.com/verse-rb)
- [Verse Schema](https://github.com/verse-rb/verse-schema)

## Support

1. Check existing plugin examples in [plugins/](../../plugins) directory
2. Review the IDAH platform documentation
3. Contact the IDAH development team

Happy coding! 🚀
