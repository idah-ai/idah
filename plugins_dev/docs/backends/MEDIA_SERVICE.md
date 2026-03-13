# Media Service Backend

This guide covers developing Media service backends for IDAH plugins. Media services process media files like images, videos, and audio.

## Overview

The Media service backend registers a processor that handles media file processing. It's initialized when the IDAH platform starts and processes media files as jobs.

## File Structure

```
backends/media/
└── <plugin_name_underscore>/
    ├── media.rb          # Media service module (registers processor)
    ├── media_spec.rb     # Media service tests
    ├── processor.rb      # Core processing logic
    ├── processor_spec.rb # Processor tests
    ├── options.rb        # Options schema and validation
    └── options_spec.rb   # Options tests
```

## Module Structure

### Main Entry Point

```ruby
# frozen_string_literal: true

module YourPlugin
  class Media
    def self.init(context)
      context.register_processor(
        "your-plugin",                           # Processor identifier
        class_name: "YourPlugin::Processor",     # Processor class name
        options_class_name: "YourPlugin::Options" # Options class (optional, defaults to "Schema::Empty")
      )
    end
  end
end
```

**Plugin Lifecycle Context Methods:**
- `register_processor(name, class_name:, options_class_name:)` - Register your media processor

## Processor Implementation

```ruby
# frozen_string_literal: true

module YourPlugin
  class Processor
    def initialize(options)
      @options = options
    end

    def process(context)
      # Download original media file
      input_path = context.download_original

      # Process the media
      output_io = transform_media(input_path)

      # Upload processed result
      context.upload_media(
        output_io,
        "thumbnail.jpg",
        "image/jpeg"
      )

      # Update progress
      context.progress = 100
    end

    private

    def transform_media(input_path)
      # Your processing logic here
      # Return an IO object (e.g., File.open or StringIO)
    end
  end
end
```

## Processor Context API

When `#process` is called, you receive a context with these methods:

### Attributes (Read-Only)

```ruby
context.resource      # Resource identifier being processed
context.config        # Configuration data
context.job           # Job information
```

### Methods

#### `download_original() → String`

Downloads the original media file and returns a temp file path:

```ruby
input_path = context.download_original
# => "/tmp/idah_media_abc123_xyz456"
```

#### `upload_media(io, key, mime_type) → void`

Uploads processed media:

```ruby
# Upload from a file on disk
context.upload_media(
  File.open("output.jpg"),  # IO object
  "thumbnail.jpg",          # Key/identifier
  "image/jpeg"              # MIME type
)

# Upload from in-memory data
context.upload_media(
  StringIO.new(image_data), # StringIO for raw data
  "thumbnail.jpg",
  "image/jpeg"
)
```

**Parameters:**
- `io` - IO object (e.g., `File.open(path)`, `StringIO.new(data)`). If a String is passed, it will be treated as raw content, not a file path.
- `key` - Identifier for the processed media (e.g., "thumbnail.jpg", "720p.mp4")
- `mime_type` - MIME type of the processed media

**Note:** If you have a file path, you must open it first with `File.open(path)` or use `File.open(path, "rb")` for binary files.

#### `progress=(value) → void`

Update job progress (0-100):

```ruby
context.progress = 50  # 50% complete
```

#### `reschedule!(after:) → void`

Reschedule the job for later processing:

```ruby
context.reschedule!(after: 10)  # Retry after 10 seconds
```

#### `error!(message) → void`

Mark the job as failed:

```ruby
context.error!("FFmpeg encoding failed: #{error_message}")
```

## Options Schema

Define and validate processor options using Verse Schema:

```ruby
# frozen_string_literal: true

require "verse/schema"

module YourPlugin
  class Options < Verse::Schema::Struct
    # Define attributes with types and defaults
    attribute :quality, Integer, default: 80
    attribute :format, String, default: "webp"
    attribute :resize, Boolean, default: false
    attribute :width, Integer, default: 1920
    attribute :height, Integer, default: 1080

    # Custom validation
    def validate
      super

      errors.add(:quality, "must be between 1 and 100") unless (1..100).cover?(quality)

      if resize && (width <= 0 || height <= 0)
        errors.add(:base, "width and height must be positive when resize is enabled")
      end
    end
  end
end
```

**Available Types:**
- `String`, `Integer`, `Float`, `Boolean`
- `Array`, `Hash`
- Custom Verse Schema types

## Complete Example

Here's a complete media processor example:

```ruby
# media/your_plugin.rb
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

# media/processor.rb
module YourPlugin
  class Processor
    def initialize(options)
      @options = options
    end

    def process(context)
      Verse.logger.info "Processing #{context.resource}"

      # Download original
      input_path = context.download_original

      # Generate thumbnail
      thumbnail = generate_thumbnail(input_path, @options.quality)
      context.upload_media(thumbnail, "thumbnail.jpg", "image/jpeg")
      context.progress = 50

      # Generate preview
      preview = generate_preview(input_path, @options.width, @options.height)
      context.upload_media(preview, "preview.mp4", "video/mp4")
      context.progress = 100

      Verse.logger.info "Processing complete"
    rescue StandardError => e
      Verse.logger.error "Processing failed: #{e.message}"
      context.error!(e.message)
      raise
    end

    private

    def generate_thumbnail(input, quality)
      # Your thumbnail generation logic
    end

    def generate_preview(input, width, height)
      # Your preview generation logic
    end
  end
end

# media/options.rb
require "verse/schema"

module YourPlugin
  class Options < Verse::Schema::Struct
    attribute :quality, Integer, default: 80
    attribute :width, Integer, default: 1920
    attribute :height, Integer, default: 1080

    def validate
      super
      errors.add(:quality, "must be between 1 and 100") unless (1..100).cover?(quality)
    end
  end
end
```

## Testing

```ruby
# frozen_string_literal: true

require "spec_helper"
require_relative "processor"
require_relative "options"

RSpec.describe YourPlugin::Processor do
  let(:options) { YourPlugin::Options.new(quality: 90) }
  let(:processor) { described_class.new(options) }

  describe "#process" do
    it "processes media successfully" do
      context = double("context")

      allow(context).to receive(:resource).and_return("test-resource")
      allow(context).to receive(:download_original).and_return("/tmp/input.mp4")
      allow(context).to receive(:upload_media)
      allow(context).to receive(:progress=)

      expect { processor.process(context) }.not_to raise_error
      expect(context).to have_received(:upload_media).at_least(:once)
    end
  end
end
```

## Real-World Example

See the **idah-video** plugin for a complete real-world implementation:
- [View idah-video media backend on GitHub](https://github.com/ingedata-ph/idah/tree/main/plugins/idah-video/backends/media/)

## Resources

- [Ruby Documentation](https://ruby-doc.org/)
- [RSpec Documentation](https://rspec.info/)
- [IDAH Repository](https://github.com/ingedata-ph/idah)

## Back to Main Guide

[← Backend Development Guide](https://github.com/ingedata-ph/idah/blob/main/plugins_dev/docs/BACKEND_DEVELOPMENT.md)
