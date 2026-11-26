# frozen_string_literal: true

require "digest"

module Annotation
  class Service < Verse::Service::Base
    include CategoryCounts::Query

    use annotations: Annotation::Repository,
        entries: Entry::Repository,
        projects: Project::Repository,
        datasets: Dataset::Repository,
        category_count_rows: EntryCategoryCount::Repository

    def category_counts(filters = {}, group_by: "category", page: {})
      scope = count_scope(filters, group_by:, page:, kind: :category)
      scope, more = count_page(scope, group_by:, category: scope[:category])
      observed = category_count_rows.category_totals(scope, group_by:, category: scope[:category])
      configuration_ids = if group_by == "dataset" && scope[:page_ids]
                            scope[:page_ids]
                          else
                            scope[:configuration_dataset_ids]
                          end
      configured = datasets.configured_categories(
        project_id: scope[:project_id],
        dataset_ids: configuration_ids,
        by_dataset: %w[dataset entry].include?(group_by)
      )
      labels = configured.group_by { |row| row[:category] }
      entry_datasets = if group_by == "entry"
                         ids = observed.map { |row| row[:entry_id] }.uniq
                         entries.scoped(:read).where(id: ids).select(:id, :dataset_id).all.to_h do |entry|
                           [entry[:id], entry[:dataset_id]]
                         end
                       else
                         {}
                       end
      rows = observed.map do |row|
        group_id = group_by == "category" ? scope[:project_id] : row.fetch("#{group_by}_id".to_sym).to_s
        matching = labels.fetch(row[:category], [])
        dataset_id = group_by == "dataset" ? group_id : entry_datasets[row[:entry_id]]&.to_s
        matching = matching.select { |item| item[:dataset_id].to_s == dataset_id } if dataset_id
        configured_label = matching.map { |item| item[:label] }.uniq
        attributes = { id: "#{group_id}:#{Digest::SHA256.hexdigest(row[:category])}", category: row[:category],
                       label: configured_label.length == 1 ? configured_label.first : row[:category],
                       configured: matching.any?, annotation_count: row[:annotation_count].to_i }
        attributes["#{group_by}_id".to_sym] = group_id unless group_by == "category"
        CategoryCount::Record.new(attributes)
      end
      if group_by == "category"
        rows_by_category = rows.to_h { |row| [row.category, row] }
        labels.each do |category, matching|
          next if rows_by_category.key?(category) || (scope[:category] && scope[:category] != category)

          configured_label = matching.map { |item| item[:label] }.uniq
          rows << CategoryCount::Record.new(
            {
              id: "#{scope[:project_id]}:#{Digest::SHA256.hexdigest(category)}", category:,
              label: configured_label.length == 1 ? configured_label.first : category,
              configured: true, annotation_count: 0
            }
          )
        end
      end
      [rows.sort_by { |row| [row.category, row.dataset_id.to_s, row.entry_id.to_s] }, more]
    end

    def total_category_counts(filters = {}, group_by: "project", page: {})
      scope = count_scope(filters, group_by:, page:, kind: :total)
      scope, more = count_page(scope, group_by:)
      observed = category_count_rows.totals(scope, group_by:)
      counts = observed.to_h { |row| [row.fetch("#{group_by}_id".to_sym).to_s, row[:annotation_count].to_i] }
      ids = if group_by == "project"
              [scope[:project_id]]
            elsif group_by == "dataset" && scope[:dataset_ids]
              scope[:dataset_ids]
            elsif group_by == "entry" && scope[:entry_ids]
              scope[:entry_ids]
            else
              counts.keys
            end
      [ids.map do |id|
        TotalCategoryCount::Record.new(
          { id:, "#{group_by}_id".to_sym => id,
            annotation_count: counts.fetch(id, 0) }
        )
      end, more]
    end

    private

    def count_page(scope, group_by:, category: nil)
      return [scope, false] unless scope[:paged]

      ids = category_count_rows.group_ids(scope, group_by:, category:, number: scope[:number], size: scope[:size])
      [scope.merge(page_ids: ids.first(scope[:size])), ids.length > scope[:size]]
    end

    public

    def index(filter = {}, included: [], page: 1, items_per_page: 1000, sort: nil, query_count: false)
      result = annotations.index(
        filter,
        included: included,
        page: page,
        items_per_page: items_per_page,
        sort: sort,
        query_count: query_count
      )

      merge_annotation_shapes(result)

      result
    end

    def show(id, included: [])
      record = annotations.find!(id, included: included)

      merge_annotation_shapes([record])

      record
    end

    def create(record)
      # Validate required relationships
      unless record.entry
        raise Verse::Error::ValidationFailed,
              "entry relationship is required to create an annotation"
      end

      # Validate required category — mirror the entry-relationship check above.
      # Do not rely on the plugin UI's gating alone; this is exactly the gap
      # that let historical null rows exist in the first place.
      if record.category.nil? || record.category.to_s.strip.empty?
        raise Verse::Error::ValidationFailed,
              "category is required to create an annotation"
      end

      # Organization Owner can find the entry in their scope
      # Project Owner can find the entry in their projects
      # Annotator and Reviewer can find the entry only if assigned to them
      entry = entries.find(record.entry.id)

      unless entry
        raise Verse::Error::ValidationFailed,
              "entry not found to create an annotation"
      end

      # Prevent modifications on completed entries
      check_entry_not_completed!(entry, :create)

      # Creating an annotation requires effective rank >= project_owner on the
      # project, or an annotator/reviewer membership on the entry's project.
      ensure_annotation_create_access!(entry.project_id)

      # Assign attributes
      attributes = record.attributes
      attributes[:id] = record.id || UUIDv7.generate
      attributes[:project_id] = entry.project_id
      attributes[:dataset_id] = entry.dataset_id
      attributes[:entry_id] = entry.id
      attributes[:created_by_email] = auth_context.metadata[:email]

      begin
        annotations.transaction do
          id = annotations.create(attributes)
          annotations.find!(id)
        end
      # Rescue Verse::Error::CannotCreateRecord to catch a retry create from a
      # slow client that may have hung up on the previous response.
      # PS: it only solve for create with no further updates in the same rpc batch
      rescue Verse::Error::CannotCreateRecord => e
        annotation = annotations.find(attributes[:id])
        raise e unless annotation

        annotation_h = annotation.to_h
        sliced_annotation = annotation_h.except(*(annotation_h.keys - attributes.keys))
        raise e unless sliced_annotation == attributes

        annotation
      end
    end

    def update(record)
      annotations.transaction do
        annotation = annotations.find!(record.id, included: [:entry])

        check_entry_not_completed!(annotation.entry, :update)

        annotations.update!(record.id, record.attributes)
        annotations.find!(record.id)
      end
    end

    def update_attr(id, attributes)
      annotations.transaction do
        annotation = annotations.find!(id, included: [:entry])

        check_entry_not_completed!(annotation.entry, :update)

        annotations.update!(id, attributes)
        annotations.find!(id)
      end
    end

    def delete(id)
      annotations.transaction do
        annotation = annotations.find!(id, included: [:entry])

        check_entry_not_completed!(annotation.entry, :delete)

        annotations.soft_delete(id, deleted_by_email: auth_context.metadata[:email])
        annotations.find!(id) # return the tombstoned record, not nil
      end
    end

    def restore(id)
      annotations.transaction do
        annotation = annotations.find!(id, included: [:entry])
        check_entry_not_completed!(annotation.entry, :update)
        annotations.restore(id)
        record = annotations.find!(id)
        merge_annotation_shapes([record])
        record
      end
    end

    # ─── Shape child-record operations ───────────────────────────────────

    #
    # Write (upsert) or delete several annotation_shape rows as one write.
    # entries is [{ key: String, value: Hash | nil }]. The RPC schema validates
    # each entry's shape; this method validates what the schema cannot express:
    # non-empty, unique non-empty keys, at most WRITE_SHAPES_MAX_ENTRIES, and a
    # missing value meaning nil (delete). The repository owns the SQL; the
    # service keeps the permission and entry-completion guards, enforced
    # uniformly regardless of direction (write or delete).
    #
    WRITE_SHAPES_MAX_ENTRIES = 1000

    def write_shapes(annotation_id, entries)
      entries = entries.to_a

      raise Verse::Error::ValidationFailed, "entries must not be empty" if entries.empty?

      if entries.size > WRITE_SHAPES_MAX_ENTRIES
        raise Verse::Error::ValidationFailed,
              "too many entries (max #{WRITE_SHAPES_MAX_ENTRIES})"
      end

      normalized = entries.map do |entry|
        key = entry[:key]
        value = entry[:value]

        if key.nil? || key.to_s.strip.empty?
          raise Verse::Error::ValidationFailed, "key is required"
        end

        unless value.nil? || value.is_a?(Hash)
          raise Verse::Error::ValidationFailed,
                "value must be null (to delete) or a Hash (to upsert)"
        end

        { key: key.to_s, value: }
      end

      keys = normalized.map { |e| e[:key] }
      if keys.uniq.size != keys.size
        raise Verse::Error::ValidationFailed, "keys must be unique"
      end

      annotations.transaction do
        annotation = annotations.find!(annotation_id, included: [:entry])

        check_entry_not_completed!(annotation.entry, :update)

        # Guard against writing shape tiles to a soft-deleted annotation — a
        # stale client could otherwise resurrect data on a tombstoned annotation
        # via the tile-sync path.
        if annotation.deleted_at
          raise Verse::Error::ValidationFailed,
                "Cannot write shape to a deleted annotation"
        end

        annotations.write_shapes(annotation_id, normalized)
      end
    end

    def write_shape(annotation_id, key, value)
      write_shapes(annotation_id, [{ key:, value: }])
    end

    private

    def merge_annotation_shapes(records)
      annotation_ids = records.map(&:id)
      return if annotation_ids.empty?

      rows = nil
      annotations.client do |db|
        rows = db[:annotation_shape]
               .where(annotation_id: annotation_ids)
               .all
      end

      return if rows.empty?

      grouped = rows.group_by { |r| r[:annotation_id] }

      records.each do |record|
        shapes = grouped[record.id]
        next unless shapes

        shapes.each do |shape|
          # Convert DB row to plain Ruby types:
          # - key is a symbol from Sequel, convert to string
          # - value is a Sequel::Postgres::JSONBHash (Delegator wrapping Hash),
          #   convert to plain Hash via .to_h (which unwraps Delegator)
          key = shape[:key].to_s
          val = shape[:value].respond_to?(:to_h) ? shape[:value].to_h : shape[:value]

          record.shape_args[key] = val
        end
      end
    end

    def check_entry_not_completed!(entry, operation)
      return unless entry&.status == "completed"

      raise Verse::Error::ValidationFailed,
            "Cannot #{operation} annotations on a completed entry"
    end

    # Creating an annotation requires effective rank >= project_owner, or an
    # annotator/reviewer membership on the entry's project. Decides on the
    # resolver so an org_owner with a membership on a foreign project is
    # evaluated with their membership role.
    def ensure_annotation_create_access!(project_id)
      access = ProjectAccess::Service.resolve(
        auth_context, project_id, action: :create, resource: annotations.class.resource
      )
      return if %i[all org_owner].include?(access)

      return if %i[project_owner annotator reviewer].include?(access)

      raise Verse::Error::Unauthorized,
            "You do not have permission to create annotation on this project"
    end
  end
end
