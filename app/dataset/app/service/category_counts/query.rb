# frozen_string_literal: true

require "digest"

module CategoryCounts
  module Query
    UUID = /\A[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\z/i
    GROUPS = { category: %w[category project dataset entry], total: %w[project dataset entry] }.freeze

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
      if group_by == "dataset" && scope[:category]
        rows.sort_by! { |row| [-row.annotation_count, row.dataset_id] }
      else
        rows.sort_by! { |row| [row.category, row.dataset_id.to_s, row.entry_id.to_s] }
      end
      [rows, more]
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

    def count_scope(filters, group_by:, page:, kind:)
      invalid = -> { raise Verse::Error::ValidationFailed, "Invalid category count filters" }
      invalid.call unless filters.nil? || filters.is_a?(Hash)
      filters = (filters || {}).transform_keys(&:to_sym)
      invalid.call unless filters.is_a?(Hash) && (filters.keys - %i[project_id dataset_id entry_id category]).empty?
      invalid.call if kind == :total && filters.key?(:category)
      project_id = filters[:project_id]
      invalid.call if project_id && (!project_id.is_a?(String) || !project_id.match?(UUID))
      project_id = project_id.downcase if project_id
      ids = {}
      %i[dataset_id entry_id].each do |key|
        next unless filters.key?(key)

        value = filters[key]
        invalid.call unless value.is_a?(Array) && value.length.between?(1, 100) &&
                            value.all? { |id| id.is_a?(String) && id.match?(UUID) }
        ids[key] = value.map(&:downcase).uniq
      end
      invalid.call unless project_id || ids[:entry_id]
      category = filters[:category]
      invalid.call if category && (!category.is_a?(String) || category.empty?)
      invalid.call unless GROUPS.fetch(kind).include?(group_by)
      invalid.call if group_by == "entry" && !ids[:dataset_id] && !ids[:entry_id]

      invalid.call unless page.nil? || page.is_a?(Hash)
      page = (page || {}).transform_keys(&:to_sym)
      invalid.call unless page.is_a?(Hash) && (page.keys - %i[number size]).empty?
      number = page.fetch(:number, 1).to_s
      size = page.fetch(:size, 10).to_s
      invalid.call unless number.match?(/\A[1-9]\d*\z/) && size.match?(/\A[1-9]\d*\z/)
      number, size = number.to_i, size.to_i
      invalid.call unless size.between?(10, 500)
      invalid.call if !%w[dataset entry].include?(group_by) && !page.empty?

      if ids[:entry_id]
        rows = entries.scoped(:read).where(id: ids[:entry_id]).select(:id, :project_id, :dataset_id).all
        invalid.call unless rows.length == ids[:entry_id].length
        projects_in_entries = rows.map { |row| row[:project_id].to_s }.uniq
        invalid.call unless projects_in_entries.length == 1 && (!project_id || projects_in_entries.first == project_id)
        project_id ||= projects_in_entries.first
      end
      projects.find!(project_id)
      if ids[:dataset_id]
        available = datasets.scoped(:read).where(project_id:, id: ids[:dataset_id]).select_map(:id).map(&:to_s)
        invalid.call unless available.length == ids[:dataset_id].length
      end
      if ids[:entry_id] && ids[:dataset_id] && !rows.all? { |row| ids[:dataset_id].include?(row[:dataset_id].to_s) }
        invalid.call
      end
      paged = %w[dataset entry].include?(group_by) && !ids[group_by == "dataset" ? :dataset_id : :entry_id]
      { project_id:, dataset_ids: ids[:dataset_id], entry_ids: ids[:entry_id],
        configuration_dataset_ids: ids[:entry_id] ? rows.map { |row| row[:dataset_id].to_s }.uniq : ids[:dataset_id],
        category:, number:, size:, paged: }
    end
  end
end
