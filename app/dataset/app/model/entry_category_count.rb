# frozen_string_literal: true

module EntryCategoryCount
  module Filter
    def self.parse(value, allowed:)
      data = value.is_a?(String) ? JSON.parse(value, symbolize_names: true) : value
      data = [data] unless data.is_a?(Array)
      raise Verse::Error::ValidationFailed, "Category conditions are required" if data.empty?

      data.map do |condition|
        raise Verse::Error::ValidationFailed, "Invalid category condition" unless condition.is_a?(Hash)

        condition = condition.transform_keys(&:to_sym)
        unless (condition.keys - allowed).empty? && condition[:category].is_a?(String) && !condition[:category].empty?
          raise Verse::Error::ValidationFailed, "Invalid category condition"
        end

        (condition.keys - [:category]).each do |key|
          value = condition[key]
          unless value.is_a?(Integer) || (value.is_a?(String) && value.match?(/\A\d+\z/))
            raise Verse::Error::ValidationFailed, "#{key} must be a nonnegative integer"
          end

          condition[key] = value.to_i
          raise Verse::Error::ValidationFailed, "#{key} must be a nonnegative integer" if condition[key].negative?
        end
        condition
      end
    rescue JSON::ParserError
      raise Verse::Error::ValidationFailed, "Invalid category filter JSON"
    end
  end

  class Record < Verse::Model::Record::Base
    type Resource::Dataset::EntryCategoryCounts

    field :id, type: String, primary: true
    field :entry_id, type: String, readonly: true
    field :dataset_id, type: String, readonly: true
    field :project_id, type: String, readonly: true
    field :category, type: String, readonly: true
    field :count, type: Integer, readonly: true
  end

  class Repository < Verse::Sequel::Repository
    self.table = "entry_category_counts"
    self.resource = Resource::Dataset::EntryCategoryCounts

    def scoped(action)
      auth_context.can!(action, self.class.resource) do |scope|
        scope.all? { table }
        scope.as_org_owner? { visible_entry_counts }
        scope.as_user? { visible_entry_counts }
      end
    end

    def category_totals(scope, group_by:, category: nil)
      grouped(scope, group_by:, category:)
        .group(*(group_by == "category" ? [:category] : [GROUP_COLUMN.fetch(group_by), :category]))
        .select(*(group_by == "category" ? [:category] : [GROUP_COLUMN.fetch(group_by), :category]),
                Sequel.function(
                  :sum,
                  :count
                ).as(:annotation_count)).order(*(if group_by == "category"
                                                   [:category]
                                                 else
                                                   [GROUP_COLUMN.fetch(group_by),
                                                    :category]
                                                 end)).all
    end

    def totals(scope, group_by:)
      column = GROUP_COLUMN.fetch(group_by)
      grouped(scope, group_by:).group(column).select(column, Sequel.function(:sum, :count).as(:annotation_count))
                               .order(column).all
    end

    def group_ids(scope, group_by:, number:, size:, category: nil)
      column = GROUP_COLUMN.fetch(group_by)
      groups = grouped(scope, group_by:, category:)
      groups = if group_by == "dataset" && category
                 groups.group(column).order(Sequel.desc(Sequel.function(:sum, :count)), column)
               else
                 groups.distinct.order(column)
               end
      groups.limit(size + 1, (number - 1) * size).select_map(column)
    end

    private

    GROUP_COLUMN = { "project" => :project_id, "dataset" => :dataset_id, "entry" => :entry_id }.freeze

    def grouped(scope, group_by:, category: nil)
      rows = scoped(:read).where(project_id: scope[:project_id])
      rows = rows.where(dataset_id: scope[:dataset_ids]) if scope[:dataset_ids]
      rows = rows.where(entry_id: scope[:entry_ids]) if scope[:entry_ids]
      rows = rows.where(category:) if category
      rows = rows.where(GROUP_COLUMN.fetch(group_by) => scope[:page_ids]) if scope[:page_ids]
      rows
    end

    def visible_entry_counts
      visible_entries = Entry::Repository.new(auth_context).scoped(:read).select(:id)
      table.where(entry_id: visible_entries)
    end
  end
end
