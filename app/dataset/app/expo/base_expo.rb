# frozen_string_literal: true

require "verse/json_api"

class BaseExpo < Verse::Exposition::Base
  PROJECT_DATASET_FILTER_SCHEMA = Verse::Schema.define do
    # Retain unknown keys until the rule below rejects them, even in non-strict mode.
    extra_fields
    uuid = /\A[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\z/i
    field(:project_id, String).rule("must be a UUID") { |value| value.match?(uuid) }
    field?(:dataset_id, Array, of: String).rule("must contain 1 to 100 Dataset UUIDs") do |values|
      values.length.between?(1, 100) && values.all? { |value| value.match?(uuid) }
    end
    rule(nil, "Unknown Project/Dataset filter keys") do |value|
      (value.keys.map(&:to_sym) - [:project_id, :dataset_id]).empty?
    end
  end

  def self.inherited(klass)
    super
    klass.renderer Verse::JsonApi::Renderer
  end
end
