# frozen_string_literal: true

module NoteFeed
  ArgumentsSchema = Verse::Schema.define do
    field :entry_id, String, required: true
    field? :annotation_id, String
    field :anchor_type, String, required: true
    field? :position, Hash
    field? :content_md, String
    field? :feedback_key, String

    # Validate that annotation_id is required when anchor_type is "annotation"
    rule("annotation_id is required when anchor_type is 'annotation'") do |data|
      if data[:anchor_type] == "annotation"
        !data[:annotation_id].nil? && !data[:annotation_id].empty?
      else
        true
      end
    end

    # At least one of feedback_key or content_md must be provided
    rule("either feedback_key or content_md must be provided") do |data|
      has_feedback_key = data.key?(:feedback_key) && !data[:feedback_key].nil? && !data[:feedback_key].empty?
      has_content_md = data.key?(:content_md) && !data[:content_md].nil? && !data[:content_md].empty?
      has_feedback_key || has_content_md
    end
  end
end
