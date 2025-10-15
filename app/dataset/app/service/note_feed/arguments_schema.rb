# frozen_string_literal: true

module NoteFeed
  ArgumentsSchema = Verse::Schema.define do
    field :entry_id, String, required: true
    field? :annotation_id, String
    field :anchor_type, String, required: true
    field? :position, Hash
    field :content_md, String

    # Validate that annotation_id is required when anchor_type is "annotation"
    rule("annotation_id is required when anchor_type is 'annotation'") do |data|
      if data[:anchor_type] == "annotation"
        !data[:annotation_id].nil? && !data[:annotation_id].empty?
      else
        true
      end
    end

    rule("content_md cannot be empty") do |data|
      if data.key?(:content_md)
        !data[:content_md].nil? && !data[:content_md].empty?
      else
        true
      end
    end
  end
end
