# frozen_string_literal: true

class FeedbackConfigTemplatesExpo < BaseExpo
  http_path "/feedback_config_templates"

  use_service FeedbackConfigTemplate::Service

  desc <<~MD
    Reusable feedback configuration templates, scoped to an organization,
    that project owners can apply when configuring datasets.
  MD

  json_api FeedbackConfigTemplate::Record do
    show
    index do
      allowed_filters :organization_id,
                      :organization_id__in,
                      :modality,
                      :modality__in,
                      :name__match
    end
    create
    update
    delete
  end
end