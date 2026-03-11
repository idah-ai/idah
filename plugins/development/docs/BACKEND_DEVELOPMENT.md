# Backend Development Guide

This guide covers backend development for IDAH plugins using Ruby.

## Overview

IDAH plugins can have backend services that process media files, export data, or integrate with external systems. Backend services are written in Ruby and follow a modular structure.

## Available Backend Services

### Media Service

The Media service handles media file processing (images, videos, audio, etc.).

**Key Components:**

- **Processor** - Core processing logic
- **Options** - Configuration and validation
- **Plugin Module** - Registration and initialization

**File Structure:**
```
backends/media/
├── {plugin_name}.rb        # Main entry point with .init method
├── {plugin_name}_spec.rb   # Tests for main module
├── processor.rb             # Processing logic
├── processor_spec.rb        # Processor tests
├── options.rb               # Options schema
└── options_spec.rb          # Options tests
```

### Sync Service

The Sync service handles data export and synchronization with external systems.

**Key Components:**

- **Export** - Export/sync logic
- **Plugin Module** - Registration and initialization

**File Structure:**
```
backends/sync/
├── {plugin_name}.rb        # Main entry point with .init method
├── {plugin_name}_spec.rb   # Tests for main module
├── export.rb                # Export logic
└── export_spec.rb           # Export tests
```

## Backend Module Structure

### Media Backend Example

```ruby
# frozen_string_literal: true

module YourPlugin
  class Media
    def self.init(context)
      context.register_processor(
        "your-plugin",
        class_name: "YourPlugin::Processor",
        options_class_name: "YourPlugin::Options"
      )
    end
  end
end
```

### Sync Backend Example

```ruby
# frozen_string_literal: true

module YourPlugin
  class Sync
    def self.init(context)
      context.register_exports(
        "your-plugin",
        YourPlugin::Export
      )
    end
  end
end
```

## Processor Implementation

The Processor class handles the actual media processing:

```ruby
# frozen_string_literal: true

module YourPlugin
  class Processor
    def initialize(options)
      @options = options
    end

    def process(context)
      # Your processing logic here
      # Access input file: context.input_file
      # Write output: context.output_file

      # Example:
      # process_media(context.input_file, context.output_file, @options)
    end
  end
end
```

## Options Schema

Define and validate processor options:

```ruby
# frozen_string_literal: true

require "verse/schema"

module YourPlugin
  class Options < Verse::Schema::Struct
    # Define your options
    attribute :quality, Integer, default: 80
    attribute :format, String, default: "webp"
    attribute :resize, Boolean, default: false

    # Custom validation
    def validate
      super
      errors.add(:quality, "must be between 1 and 100") unless (1..100).cover?(quality)
    end
  end
end
```

## Export Implementation

The Export class handles data export/synchronization:

```ruby
# frozen_string_literal: true

module YourPlugin
  class Export
    def initialize(options = {})
      @options = options
    end

    def export(context)
      # Your export logic here
      # Access entry data: context.entry
      # Access dataset: context.dataset

      # Example:
      # send_to_external_service(context.entry, @options)
    end
  end
end
```

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

## Dependencies

### Gemfile

Add dependencies to your plugin's Gemfile:

```ruby
source "https://rubygems.org"

# IDAH common libraries
gem "verse", path: "../../common"

group :test do
  gem "rspec"
  gem "webmock"
  gem "simplecov"
end

# Your plugin-specific dependencies
gem "mini_magick", "~> 4.11"  # Example
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
    logger.error("Processing failed: #{e.message}")
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

## Integration with IDAH

### Plugin Lifecycle Context

The `context` object passed to your plugin's `.init` method provides registration methods:

#### Media Service Context

```ruby
# In your plugin's .init method
def self.init(context)
  context.register_processor(
    "plugin-name",                        # Processor identifier
    class_name: "YourPlugin::Processor",  # Processor class name
    options_class_name: "YourPlugin::Options"  # Options class name (optional, defaults to "Schema::Empty")
  )
end
```

**Methods Available:**
- `context.register_processor(name, class_name:, options_class_name:)` - Register a media processor
- `context.mount_plugin(plugin_name)` - Mount the plugin (rarely needed)
- `context.unmount_plugin` - Unmount and clean up

#### Sync Service Context

```ruby
# In your plugin's .init method
def self.init(context)
  context.register_exports(
    "plugin-name",           # Export identifier
    YourPlugin::Export       # Export class
  )
end
```

**Methods Available:**
- `context.register_exports(modalities, klass)` - Register an export handler

### Processor Context (During Processing)

When your processor's `#process` method is called, you'll receive a processing context with these methods:

```ruby
def process(context)
  # Read-only attributes
  context.resource      # Resource identifier being processed
  context.config        # Configuration data
  context.job           # Job information

  # Download original media
  input_path = context.download_original  # Returns temp file path

  # Process your media
  output_io = process_media(input_path) # Your own processing method

  # Upload processed media
  context.upload_media(
    output_io,          # IO object or file path
    "thumbnail.jpg",    # Key/filename for the processed media
    "image/jpeg"        # MIME type
  )

  # Update progress (0-100)
  context.progress = 50

  # Reschedule job if needed
  context.reschedule!(after: 10)  # Reschedule after 10 seconds

  # Mark as error
  context.error!("Processing failed")
end
```

**Key Methods:**

- `download_original()` - Downloads the original media file, returns temp file path
- `upload_media(io, key, mime_type)` - Uploads processed media
  - `io` - IO object, file path, or string
  - `key` - Identifier for the processed media
  - `mime_type` - MIME type of the processed media
- `progress=` - Update job progress (0-100)
- `reschedule!(after:)` - Reschedule the job
- `error!(message)` - Mark job as errored with a message

### Registration

Backends are automatically loaded by IDAH when the plugin is installed. The `.init` method is called during platform initialization with a `PluginLifecycleContext` instance.

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
- [Verse Schema Documentation](../../common/lib/verse/schema)

## Support

1. Check existing plugin examples in `plugins/` directory
2. Review the IDAH platform documentation
3. Contact the IDAH development team

Happy coding! 🚀
