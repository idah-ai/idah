# Register default UPD format for
# every modalities
Export::Registry.register(
  /.*/,
  Upd::Exporter
)