# frozen_string_literal: true

# Register default UPD format for
# every plugin and for all modalities.
Exports::Registry.register(
  "*",
  /.*/,
  Exports::Upd::Exporter
)
