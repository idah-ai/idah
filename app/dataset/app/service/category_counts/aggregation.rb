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
      labels = rows.group_by(&:category).transform_values { |group| group.map(&:label).uniq }
      rows.group_by { |row| [row.category, row.label] }.map do |(category, label), group|
        # Hash the tuple rather than joining it: category IDs and labels can contain separators.
        key = Digest::SHA256.hexdigest(JSON.generate([category, label]))
        ProjectCategoryTotal::Record.new(
          { id: "#{project_id}:#{key}", project_id:, category:, label:,
            annotation_count: group.sum(&:annotation_count), configured: group.any?(&:configured),
            label_conflict: labels.fetch(category).length > 1,
            datasets: group.map { |row| { id: row.dataset_id, name: names.fetch(row.dataset_id) } } }
        )
      end.sort_by { |row| [-row.annotation_count, row.label, row.category] }
    end
  end
end
