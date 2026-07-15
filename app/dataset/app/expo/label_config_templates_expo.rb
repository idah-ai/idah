# frozen_string_literal: true

class LabelConfigTemplatesExpo < BaseExpo
  http_path "/label_config_templates"

  use_service LabelConfigTemplate::Service

  desc <<~MD
    Reusable labeling configuration templates, scoped to an organization,
    that project owners can apply when configuring datasets.
  MD

  json_api LabelConfigTemplate::Record do
    show
    index do
      allowed_filters :organization_id,
                      :organization_id__in,
                      :name__match
    end
    create
    update
    delete
  end
end
