# frozen_string_literal: true

module AnnotationChange
  class Service < Verse::Service::Base
    use changes: AnnotationChange::Repository, annotations: Annotation::Repository

    # Default sort for history: an entry's history mixes several annotations, so
    # `version` alone does not order it; changed_at desc, then version desc.
    DEFAULT_SORT = ["-changed_at", "-version"].freeze

    def index(filter = {}, included: [], page: 1, items_per_page: 1000, sort: nil, query_count: false)
      changes.index(
        filter,
        included: included,
        page: page,
        items_per_page: items_per_page,
        sort: sort || DEFAULT_SORT,
        query_count: query_count
      )
    end

    def show(id, included: [])
      changes.find!(id, included: included)
    end

    # Rebuild an annotation as it was at a past version. Loads the current
    # annotation (which merges annotation_shape and applies read scoping), then
    # reverts every history row with a version above the target, newest first.
    def rebuild(annotation_id, version)
      raise Verse::Error::ValidationFailed, "version must be >= 1" if version < 1

      current = Annotation::Service.new(auth_context).show(annotation_id)

      if version > current.version
        raise Verse::Error::ValidationFailed,
              "version #{version} is above the current version #{current.version}"
      end

      rows = changes.index(
        { annotation_id:, version__gt: version },
        sort: ["-version"],
        items_per_page: 10_000
      )

      state = {
        "shape_type" => current.shape_type,
        "shape_args" => current.shape_args,
        "category" => current.category,
        "properties" => current.properties,
        "metadata" => current.metadata,
        "deleted_at" => current.deleted_at,
        "deleted_by_email" => current.deleted_by_email
      }

      reverted = AnnotationDiff.revert(state, rows.flat_map(&:changes))

      target_row = changes.find_by({ annotation_id:, version: })

      Annotation::Record.new(
        {
          id: current.id,
          entry_id: current.entry_id,
          project_id: current.project_id,
          dataset_id: current.dataset_id,
          created_by_email: current.created_by_email,
          created_at: current.created_at,
          updated_at: target_row&.changed_at,
          version: version,
          shape_type: reverted["shape_type"],
          shape_args: reverted["shape_args"],
          category: reverted["category"],
          properties: reverted["properties"],
          metadata: reverted["metadata"],
          deleted_at: reverted["deleted_at"] && Time.parse(reverted["deleted_at"]),
          deleted_by_email: reverted["deleted_by_email"]
        }
      )
    end
  end
end
