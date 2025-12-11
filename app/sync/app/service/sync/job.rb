# frozen_string_literal: true
module Sync
  class Job < Jobs::Base
    attr_reader :dataset_id

    def run_impl
      dataset_response = Api[:idah].dataset.datasets.show(id: arguments.fetch(:dataset_id))
      raise dataset_response.errors if dataset_response.errors

      sync_process = Verse::Util::Reflection.constantize(arguments.fetch(:process_class)).new(
        Verse::Util::Reflection.constantize(arguments.fetch(:context_class)).new(
          [:export, dataset_response.data[:id], Time.now.to_i],
          [DatasetContext.from_dataset(dataset_response.data)]
        )
      )

      # I can't make up my mind.
      # if we give context consumption responsability to plugin #
      # /and keep an eye on consumption in context construction
      if arguments.fetch(:hooked) == false
        sync_process.run
      else # or if we want to handle the processing entirelly
        sync_process.sync do |&block|
          sync_process.on_init [
            :export, dataset_response.data[:id], Time.now.to_i
          ].join("."), &block
          Verse::Util::Reflection.constantize(arguments.fetch(:context_class)).new(
            [:export, dataset_response.data[:id], Time.now.to_i],
            [] # shouldnt need to consume anything
            # [DatasetContext.from_dataset(dataset_response.data)]
          ).datasets.each do |dataset_context|
            sync_process.on_dataset dataset_context, &block
            dataset_context.entries.each do |entry_context|
              sync_process.on_entry entry_context, &block
              entry_context.annotations.each do |annotation_context|
                sync_process.on_annotation annotation_context.annotation, &block
              end
            end
          end
          sync_process.on_close
        end
      end
    end
  end
end
