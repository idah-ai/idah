# frozen_string_literal: true

require "digest"

module CategoryCounts
  module Aggregation
    def self.dataset_rows(datasets, observed)
      counts = observed.group_by { |row| row[:dataset_id] }
      datasets.flat_map do |dataset|
        labels = {}
        (dataset.labeling_configuration || {}).each_value do |tool|
          next unless tool.is_a?(Hash)

          Array(tool[:values]).each do |value|
            next unless value.is_a?(Hash) && value[:id].is_a?(String)

            label = value[:label]
            labels[value[:id]] ||= label.is_a?(String) && !label.empty? ? label : value[:id]
          end
        end
        totals = Array(counts[dataset.id]).to_h { |row| [row[:category], row[:annotation_count]] }
        (labels.keys | totals.keys).sort.map do |category|
          DatasetCategoryTotal::Record.new(
            { id: "#{dataset.id}:#{category}", dataset_id: dataset.id, category:,
              label: labels.fetch(category, category), configured: labels.key?(category),
              annotation_count: totals.fetch(category, 0) }
          )
        end
      end
    end

    def self.project_rows(project_id, datasets, rows)
      names = datasets.to_h { |dataset| [dataset.id, dataset.name] }
      rows.group_by(&:category).map do |category, group|
        # Use the category ID when dataset labels disagree, rather than favoring one dataset's label.
        labels = group.map(&:label).uniq
        label = labels.length == 1 ? labels.first : category
        key = Digest::SHA256.hexdigest(category)
        ProjectCategoryTotal::Record.new(
          { id: "#{project_id}:#{key}", project_id:, category:, label:,
            annotation_count: group.sum(&:annotation_count), configured: group.any?(&:configured),
            datasets: group.map do |row|
              { id: row.dataset_id, name: names.fetch(row.dataset_id), label: row.label,
                configured: row.configured, annotation_count: row.annotation_count }
            end }
        )
      end.sort_by { |row| [-row.annotation_count, row.label, row.category] }
    end
  end
end
