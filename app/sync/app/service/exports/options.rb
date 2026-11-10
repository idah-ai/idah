# frozen_string_literal: true

module Exports
  # The options an exporter declares beside the general ones every export has
  # (`include_medias`, `completed_entries`).
  #
  # An exporter declares them as the Verse::Schema returned by its `options`
  # method. Each field is shown in the export dialog, so it carries display
  # hints in its `meta`:
  #
  #   field(:task, String).default("detect")
  #     .meta(label: "Task", description: "…", choices: %w[detect segment obb])
  #   field(:val_percent, Integer).default(0).meta(label: "Validation (%)", min: 0, max: 50)
  #
  # A choice is a value, or a hash that explains it in the dialog:
  #
  #   choices: [{ value: "obb", label: "Oriented boxes (rotated)", info: "…" }]
  #
  # `choices`, `min` and `max` are enforced here, so exporters need no rules
  # of their own for them.
  module Options
    extend self

    GENERAL = %i[include_medias completed_entries].freeze

    # Field types the export dialog can show, by the name it knows them by.
    TYPES = {
      String => "string",
      TrueClass => "boolean",
      Integer => "integer",
      Float => "number"
    }.freeze

    DISPLAY_HINTS = %i[label description min max].freeze

    # The options as the export dialog reads them from `/exports/formats`.
    # @return [Array<Hash>]
    def describe(schema)
      schema.fields.map do |field|
        meta = field.opts[:meta] || {}
        description = {
          name: field.key.to_s,
          type: TYPES.fetch(field.type),
          default: field.default,
          required: field.required?
        }.merge(meta.slice(*DISPLAY_HINTS))
        description[:choices] = choices(meta) if meta[:choices]
        description
      end
    end

    # Rejects declarations the export dialog cannot show. Called when an
    # exporter is registered, so a mistake shows when the service boots.
    # @raise [ArgumentError]
    def check!(schema)
      schema.fields.each do |field|
        if GENERAL.include?(field.key)
          raise ArgumentError, "option `#{field.key}` is a general export option"
        end

        unless TYPES.key?(field.type)
          raise ArgumentError,
                "option `#{field.key}` has type #{field.type}; options can be #{TYPES.keys.join(", ")}"
        end

        meta = field.opts[:meta] || {}
        if Array(meta[:choices]).any? { |choice| choice.is_a?(Hash) && !choice.key?(:value) }
          raise ArgumentError, "option `#{field.key}` has a choice without a `value`"
        end
      end
    end

    # Validates the exporter's options of an export request.
    # @param options [Hash] the request's options, general ones included
    # @return [Hash] the general options as given, plus the exporter's options
    #   with their defaults filled in, with symbol keys
    # @raise [Verse::Error::ValidationFailed] on an unknown option, a value of
    #   the wrong type, or a value outside its choices or bounds
    def validate!(schema, options)
      options = (options || {}).to_h.transform_keys(&:to_sym)
      general = options.slice(*GENERAL)

      values, errors = validate(schema, options.except(*GENERAL))

      unless errors.empty?
        prefixed = errors.transform_keys { |key| :"options.#{key}" }
        raise Verse::Error::ValidationFailed, Verse::Schema::Result.new(nil, prefixed)
      end

      general.merge(values)
    end

    private

    # Each choice as `{ value:, label:, info: }`; a plain choice is its own
    # label.
    def choices(meta)
      meta[:choices].map do |choice|
        next { value: choice, label: choice.to_s } unless choice.is_a?(Hash)

        {
          value: choice[:value],
          label: (choice[:label] || choice[:value]).to_s,
          info: choice[:info]
        }.compact
      end
    end

    # Verse::Schema.empty is frozen and cannot validate, so an exporter
    # without options is handled here: any option is unknown to it.
    def validate(schema, options)
      if schema.fields.empty?
        return [{}, options.keys.to_h { |key| [key, ["is not allowed"]] }]
      end

      result = schema.validate(options, strict: true)
      errors = result.errors.dup
      errors = hint_errors(schema, result.value) if errors.empty?

      [result.value, errors]
    end

    def hint_errors(schema, values)
      schema.fields.each_with_object({}) do |field, errors|
        meta = field.opts[:meta] || {}
        value = values[field.key]
        next if value.nil?

        message =
          if meta[:choices] && !(allowed = choices(meta).map { |choice| choice[:value] }).include?(value)
            "must be one of: #{allowed.join(", ")}"
          elsif meta[:min] && value < meta[:min]
            "must be at least #{meta[:min]}"
          elsif meta[:max] && value > meta[:max]
            "must be at most #{meta[:max]}"
          end

        errors[field.key] = [message] if message
      end
    end
  end
end
