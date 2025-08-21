# frozen_string_literal: true

WorkflowConfigSchema = Verse.define do
  field :type, String
  field :opt, Hash
end
