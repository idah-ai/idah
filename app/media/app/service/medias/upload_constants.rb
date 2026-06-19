# frozen_string_literal: true

module Medias
  # Constants governing how uploads (single files and zip archives) are validated
  # and extracted. Kept out of the service so it holds only logic.
  module UploadConstants
    # Zip-bomb guards — see Medias::Service#scan_zip_entries.
    MAX_ENTRY_UNCOMPRESSED_SIZE = 1024 ** 3       # 1 GB  — per-file uncompressed cap
    MAX_TOTAL_UNCOMPRESSED_SIZE = 10 * 1024 ** 3  # 10 GB — per-archive uncompressed cap
    MAX_COMPRESSION_RATIO       = 100             # max uncompressed:compressed per entry

    # OS-generated metadata entries that should be silently ignored when extracting
    # a zip archive. No zip library handles this automatically — it is the
    # application's responsibility.

    # Exact filenames (matched against the entry's basename).
    SYSTEM_ARTIFACT_FILES = [
      ".DS_Store",   # macOS folder-view settings
      "Thumbs.db",   # Windows thumbnail cache
      "ehthumbs.db", # Windows (legacy) thumbnail cache
      "desktop.ini"  # Windows folder configuration
    ].freeze

    # Directory names that mark the entry as an artifact when present anywhere in its path.
    SYSTEM_ARTIFACT_DIRS = [
      "__MACOSX" # macOS AppleDouble container (._filename sidecars)
    ].freeze
  end
end
