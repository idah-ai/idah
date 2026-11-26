# frozen_string_literal: true

module CategoryCounts
  module Query
    UUID = /\A[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\z/i
    GROUPS = { category: %w[category project dataset entry], total: %w[project dataset entry] }.freeze

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
