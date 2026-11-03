# IDAH Image Annotation - Backend

This directory contains the backend services of the **IDAH Image Annotation**
plugin. The plugin system loads it in each service from the `backend` entry of
`../manifest.json` (module `IdahImage`).

## Backend Services

- **Media Service** (`media/`): processes uploaded images (`image/*`): records
  the original's width, height and format, and writes a processed copy and,
  when configured, a thumbnail. The exports read that width and height.
- **Sync Service** (`sync/`): COCO and YOLO exports of image datasets (see
  [sync/idah_image/export/README.md](sync/idah_image/export/README.md)).

Each service calls the entry point of its folder at boot:
`IdahImage::Media.init` registers the image processor, `IdahImage::Sync.init`
registers the exporters.

## Structure

```
backends/
├── spec_helper.rb                  # RSpec, Zeitwerk and coverage setup
├── spec_data/                      # Fakes of the service contexts, test data
├── media/idah_image/
│   ├── media.rb                    # IdahImage::Media, registers the processor
│   └── processor/                  # Image processing, options, image info
└── sync/idah_image/
    ├── sync.rb                     # IdahImage::Sync, registers the exporters
    └── export/                     # COCO and YOLO exports, shared helpers
```

## Running Tests

```bash
cd plugins/idah-image/backends
bundle install

# All tests
bundle exec rspec

# One service
bundle exec rspec media/
bundle exec rspec sync/

# Lint
bundle exec rubocop
```

The specs run without the services: `spec_data/` holds fakes of the contexts
the services pass in (`fake_processor_context.rb`, `fake_export_context.rb`),
and `mask_tiles.rb` builds masks as the annotation tool stores them. Coverage
reports are generated in `coverage/index.html`.
