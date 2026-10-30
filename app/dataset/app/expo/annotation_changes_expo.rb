# frozen_string_literal: true

class AnnotationChangesExpo < BaseExpo
  http_path "/annotation_changes"

  use_service AnnotationChange::Service

  desc <<~MD
    Change history of annotations. Each row records one annotation write: who
    made it, what changed (old and new values) and when. History visibility
    follows annotation visibility exactly.
  MD

  json_api AnnotationChange::Record do
    show
    index do
      allowed_filters :annotation_id,
                      :entry_id,
                      :account_id,
                      :op__in,
                      :changed_at__gte,
                      :changed_at__lte,
                      :version__gte,
                      :version__lte
    end
  end
end
