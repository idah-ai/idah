# frozen_string_literal: true

require "monitor"

class StorageRegistry
  # The storage target of a project, asked from the dataset service once and
  # kept: a project's target is set when it is created and never changes, so an
  # answer never goes stale. Nil is the default storage.
  #
  # Only answers are kept; a failed call is raised and asked again next time.
  module ProjectTargets
    CAPACITY = 10_000

    @lock = Monitor.new
    @targets = {}

    class << self
      def for(project_id)
        project_id = project_id.to_s

        @lock.synchronize do
          return @targets[project_id] if @targets.key?(project_id)
        end

        target_id = fetch(project_id)

        @lock.synchronize do
          @targets.clear if @targets.size >= CAPACITY
          @targets[project_id] = target_id
        end
      end

      # For specs.
      def reset!
        @lock.synchronize { @targets.clear }
      end

      private

      # An unknown project has no target: its files go to the default storage,
      # as before targets existed.
      def fetch(project_id)
        project = Api[:idah].dataset.projects.show(id: project_id)
        target_id = project.attributes&.[](:storage_target_id)

        target_id.to_s.empty? ? nil : target_id
      rescue Api::HTTPError => e
        raise unless e.status == 404

        nil
      end
    end
  end
end
