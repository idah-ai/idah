# frozen_string_literal: true

# Register default UPD format for
# every modalities
Exports::Registry.register(
  /.*/,
  Exports::Upd::Exporter
)
