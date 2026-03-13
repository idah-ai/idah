# Sync Service Backend

This guide covers developing Sync service backends for IDAH plugins. Sync services handle data export and synchronization with external systems.

## Overview

The Sync service backend registers an export handler that processes dataset exports. It's initialized when the IDAH platform starts and handles export jobs.

## File Structure

```
backends/sync/
└── <plugin_name_underscore>/
    ├── sync.rb           # Sync service module (registers exporter)
    ├── sync_spec.rb      # Sync service tests
    ├── export.rb         # Export/sync logic
    └── export_spec.rb    # Export tests
```

## Module Structure

### Main Entry Point

```ruby
# frozen_string_literal: true

module YourPlugin
  class Sync
    def self.init(context)
      context.register_exports(
        "your-plugin",      # Export identifier
        YourPlugin::Export  # Export class
      )
    end
  end
end
```

**Plugin Lifecycle Context Methods:**
- `register_exports(modalities, klass)` - Register your export handler

## Export Implementation

```ruby
# frozen_string_literal: true

module YourPlugin
  class Export
    def export(context)
      # Get dataset IDs being exported
      dataset_ids = context.dataset_ids

      # Get export options
      options = context.options

      # Create output file or directory
      io = context.io

      # Process datasets
      context.datasets.each do |dataset|
        export_dataset(dataset, io, options)
      end

      # Update progress
      context.progress = 1.0
    end

    private

    def export_dataset(dataset, io, options)
      # Your export logic here
    end
  end
end
```

## Export Context API

When `#export` is called, you receive a context with these methods:

### Attributes (Read-Only)

```ruby
context.dataset_ids   # Array of dataset IDs being exported
context.options       # Export options hash
context.io            # IO context for file/directory operations
```

### Methods

#### `datasets → Enumerator`

Iterate through datasets (automatically updates progress):

```ruby
context.datasets.each do |dataset|
  # dataset is a DatasetContext object
  # Access dataset data: dataset.record
  # Get entries: dataset.entries(filter)

  # Progress is auto-updated after each dataset:
  # For 2 datasets: 0.5 (50%), 1.0 (100%)
end
```

**Note:** Progress is automatically updated as you iterate. Manual progress updates are only needed if you don't use the `datasets` iterator.

## Data Context Objects

When iterating through datasets, entries, annotations, and media, you receive context objects with the following APIs:

### DatasetContext

```ruby
context.datasets.each do |dataset|
  # Access dataset data
  dataset_data = dataset.record
  dataset_id = dataset.record.id
  dataset_name = dataset.record.name
  modality = dataset.record.modality

  # Get all entries in the dataset
  entries = dataset.entries

  # Get filtered entries
  entries = dataset.entries({ status: "completed" })
end
```

**Methods:**
- `dataset` - The dataset data object
- `entries(filter = {})` - Get entries with optional filter, returns array of `EntryContext`

### EntryContext

```ruby
dataset.entries.each do |entry|
  # Access entry data
  entry_data = entry.entry
  entry_id = entry.entry.id
  resource = entry.entry.resource
  status = entry.entry.status

  # Get all annotations
  annotations = entry.annotations

  # Get filtered annotations
  annotations = entry.annotations({ type: "bounding_box" })

  # Get all medias
  medias = entry.medias

  # Get only original media
  original_media = entry.medias({ key: "" })
end
```

**Attributes:**
- `entry` - The entry data object

**Methods:**
- `annotations(filter = {})` - Get annotations with optional filter, returns array of `AnnotationContext`
- `medias(filter = {})` - Get media files with optional filter, returns array of `MediaContext`

### AnnotationContext

```ruby
entry.annotations.each do |annotation|
  # Access annotation data
  annotation_data = annotation.annotation
  annotation_id = annotation.annotation.id
  dimensions = annotation.annotation.dimensions
  annotation_value = annotation.annotation.annotation
  type = annotation.annotation.dimensions[:type]
end
```

**Attributes:**
- `annotation` - The annotation data object

### MediaContext

```ruby
entry.medias.each do |media|
  # Access media data
  media_data = media.media
  resource = media.media.resource
  key = media.media.key
  filename = media.media.filename
  mime_type = media.media.mime_type

  # Download the media file
  binary_data = media.download
end
```

**Attributes:**
- `media` - The media data object

**Methods:**
- `download` - Download the media file, returns binary data

#### `progress=(value) → void`

Manually update export progress (0.0 to 1.0):

```ruby
context.progress = 0.5  # 50% complete
```

#### `reschedule!(after:) → void`

Reschedule the export job:

```ruby
context.reschedule!(after: 60)  # Retry after 60 seconds
```

#### `error!(message) → void`

Mark the export as failed:

```ruby
context.error!("API connection failed")
```

## IO Context API

The `context.io` provides file/directory operations:

### File Mode (Single File Export)

```ruby
# Create a temp file
file = context.io.file(format: "json")

# Write data to the file
File.write(file.path, data.to_json)

# The file path will be used as the export result
```

### Directory Mode (Multiple Files)

```ruby
# Create a temp directory
dir = context.io.directory

# Write multiple files
File.write(File.join(dir, "data.json"), data.to_json)
File.write(File.join(dir, "metadata.json"), metadata.to_json)
File.write(File.join(dir, "report.txt"), report)

# Optionally zip the directory
zip_path = context.io.zip_directory
# => Returns path to zipped file
```

### Cleanup

```ruby
# Cleanup is handled automatically, but you can also do it manually:
context.io.cleanup
```

**IO Context Methods:**

- `file(format: "ext")` - Create a temp file with extension
- `directory` - Create a temp directory
- `zip_directory` - Zip the directory and return zip file path
- `cleanup` - Clean up temp files/directories

## Complete Example

Here's a complete sync export example:

```ruby
# sync/your_plugin.rb
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

# sync/export.rb
require "json"
require "net/http"

module YourPlugin
  class Export
    def export(context)
      Verse.logger.info "Starting export for #{context.dataset_ids.size} datasets"

      # Option 1: Single JSON file
      file = context.io.file(format: "json")

      all_data = []
      context.datasets.each do |dataset|
        all_data << export_dataset(dataset)
      end

      File.write(file.path, all_data.to_json)

      Verse.logger.info "Export complete"
    rescue StandardError => e
      Verse.logger.error "Export failed: #{e.message}"
      context.error!(e.message)
      raise
    end

    private

    def export_dataset(dataset)
      # Your export logic
      {
        id: dataset.record.id,
        name: dataset.record.name,
        # ... export data
      }
    end
  end
end
```

### Example: Export to External API

```ruby
module YourPlugin
  class Export
    API_URL = "https://api.example.com/import"

    def export(context)
      api_key = context.options[:api_key]

      context.datasets.each do |dataset|
        data = prepare_dataset_data(dataset)
        send_to_api(data, api_key)
        # Progress auto-updated after each dataset
      end
    end

    private

    def prepare_dataset_data(dataset)
      # Transform dataset to API format
    end

    def send_to_api(data, api_key)
      uri = URI(API_URL)
      req = Net::HTTP::Post.new(uri)
      req["Authorization"] = "Bearer #{api_key}"
      req["Content-Type"] = "application/json"
      req.body = data.to_json

      Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) do |http|
        response = http.request(req)
        raise "API error: #{response.code}" unless response.is_a?(Net::HTTPSuccess)
      end
    end
  end
end
```

### Example: Export to Multiple Files

```ruby
module YourPlugin
  class Export
    def export(context)
      # Create directory for multiple files
      dir = context.io.directory

      # Export each dataset to separate file
      context.datasets.each_with_index do |dataset, idx|
        filename = "dataset_#{idx + 1}.json"
        data = export_dataset_data(dataset)
        File.write(File.join(dir, filename), data.to_json)
      end

      # Create a summary file
      summary = generate_summary(context.dataset_ids)
      File.write(File.join(dir, "summary.txt"), summary)

      # Zip everything
      zip_path = context.io.zip_directory
      Verse.logger.info "Export zipped to #{zip_path}"
    end

    private

    def export_dataset_data(dataset)
      # Your export logic
    end

    def generate_summary(dataset_ids)
      "Exported #{dataset_ids.size} datasets"
    end
  end
end
```

## Testing

```ruby
# frozen_string_literal: true

require "spec_helper"
require_relative "export"

RSpec.describe YourPlugin::Export do
  let(:export) { described_class.new }

  describe "#export" do
    it "exports datasets successfully" do
      context = double("context")
      io = double("io")
      file = double("file", path: "/tmp/export.json")

      allow(context).to receive(:dataset_ids).and_return(["ds1", "ds2"])
      allow(context).to receive(:options).and_return({})
      allow(context).to receive(:io).and_return(io)
      allow(context).to receive(:datasets).and_return([])
      allow(context).to receive(:progress=)

      allow(io).to receive(:file).and_return(file)

      expect { export.export(context) }.not_to raise_error
    end
  end
end
```

## Best Practices

### 1. Handle Large Datasets

Process datasets in batches to avoid memory issues:

```ruby
def export(context)
  file = context.io.file(format: "json")

  File.open(file.path, "w") do |f|
    f.write("[")

    context.datasets.each_with_index do |dataset, idx|
      f.write(",") if idx > 0
      f.write(export_dataset(dataset).to_json)
    end

    f.write("]")
  end
end
```

### 2. Error Handling

```ruby
def export(context)
  context.datasets.each do |dataset|
    begin
      export_dataset(dataset)
    rescue StandardError => e
      Verse.logger.warn "Failed to export dataset #{dataset.record.id}: #{e.message}"
      # Continue with next dataset or fail completely
    end
  end
end
```

### 3. Progress Reporting

```ruby
def export(context)
  total = context.dataset_ids.size

  context.dataset_ids.each_with_index do |id, idx|
    export_dataset_by_id(id)
    context.progress = (idx + 1).to_f / total
  end
end
```

### 4. Validation

```ruby
def export(context)
  raise ArgumentError, "API key required" unless context.options[:api_key]
  raise ArgumentError, "No datasets to export" if context.dataset_ids.empty?

  # ... proceed with export
end
```

## Resources

- [Ruby Documentation](https://ruby-doc.org/)
- [RSpec Documentation](https://rspec.info/)
- [Net::HTTP Guide](https://ruby-doc.org/stdlib/libdoc/net/http/rdoc/Net/HTTP.html)

## Back to Main Guide

[← Backend Development Guide](../BACKEND_DEVELOPMENT.md)
