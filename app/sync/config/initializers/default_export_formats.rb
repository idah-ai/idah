# Register default UPD format for
# every modalities
Exports::Registry.register(
  /.*/,
  Exports::Upd::Exporter
)