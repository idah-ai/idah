# frozen_string_literal: true

# Structural validation for a dataset feedback configuration:
#   { "<generated-key>": { "label": "...", "description": "..." }, ... }
# Keys are short identifiers (1-64 chars: letters, digits, "_" or "-"); each
# item must carry a non-empty `label`, with an optional `description`.
module FeedbackConfigSchema
  # A single feedback item definition.
  Item = Verse::Schema.define do
    field :label, String
    field? :description, String

    rule("label can't be empty") do |item|
      label = item[:label]
      label.nil? || !label.to_s.strip.empty?
    end
  end

  # The whole configuration is a dictionary of items keyed by generated keys.
  Config = Verse::Schema.define do
    field :feedback_configuration, Hash, of: Item

    rule("keys must be 1-64 characters (letters, digits, '_' or '-')") do |data|
      config = data[:feedback_configuration]
      next true unless config.is_a?(Hash)

      config.keys.all? { |key| key.to_s.match?(/\A[A-Za-z0-9_-]{1,64}\z/) }
    end
  end

  # Validates a feedback configuration payload and returns the coerced hash
  # (symbolized keys). Raises Verse::Error::ValidationFailed when invalid.
  module_function

  def validate!(config)
    result = Config.validate({ feedback_configuration: config })

    return result.value[:feedback_configuration] if result.success?

    message = result.errors.map do |key, messages|
      "#{key}: #{messages.join(", ")}"
    end.join("; ")

    raise Verse::Error::ValidationFailed, "Invalid feedback configuration: #{message}"
  end
end
