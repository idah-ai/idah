# frozen_string_literal: true

module CategoryCounts
  # Shared scope validation for the project and dataset dashboard endpoints.
  # Including services inject projects, datasets, project_members and category_count_rows.
  module Dashboard
    private

    def dashboard_category_rows(project_id, filters, require_datasets: false)
      filters = filters.transform_keys(&:to_sym)
      ids = filters[:dataset_id]
      valid_id = ->(id) { id.is_a?(String) && id.match?(/\A[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\z/i) }
      if (filters.keys - [:dataset_id]).any? || !valid_id.call(project_id) ||
         (require_datasets && !filters.key?(:dataset_id)) ||
         (filters.key?(:dataset_id) && (!ids.is_a?(Array) || ids.empty? || ids.length > 100 || !ids.all?(&valid_id)))
        raise Verse::Error::ValidationFailed, "Invalid Dashboard category filters"
      end

      projects.find!(project_id)
      if auth_context.can?(:read, Resource::Dataset::Datasets) == :as_user &&
         !project_members.owner?(project_id, auth_context.metadata[:id])
        raise Verse::Error::Unauthorized, "Project owner access required"
      end

      records = datasets.for_category_counts(project_id, ids&.uniq)
      if ids && records.length != ids.uniq.length
        raise Verse::Error::ValidationFailed, "Datasets are not available in this Project"
      end

      observed = category_count_rows.totals_for_datasets(records.map(&:id))
      [records, Aggregation.dataset_rows(records, observed)]
    end
  end
end
