# frozen_string_literal: true

class LabelingConfigurationTemplatesExpo < BaseExpo
  http_path "/labeling_configuration_templates"

  use_service LabelingConfigurationTemplate::Service

  desc <<~MD
    Reusable labeling configuration templates, scoped to an organization,
    that project owners can apply when configuring datasets.
  MD

  json_api LabelingConfigurationTemplate::Record do
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
