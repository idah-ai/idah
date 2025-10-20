# frozen_string_literal: true

# TODO: This can be settings shared across the cluster of services.
# For now, we just load from YAML using the default_values.
module Settings
  extend self

  def settings
    @settings ||= Verse::Config.config.extra_fields.fetch(:default_settings)
  end

  def [](key_name)
    settings.fetch(key_name.to_sym)
  end
end
