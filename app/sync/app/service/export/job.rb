# frozen_string_literal: true
module Export
  class Job < Jobs::Base
    attr_reader :dataset_id

    def run_impl
      dataset_response = Api[:idah].dataset.datasets.show(id: arguments.fetch(:dataset_id))
      raise dataset_response.errors if dataset_response.errors

      # todo registry
      UniversalPortableDataset.new(
        RootContext.new(
          [:export, dataset_response.data[:id], Time.now.to_i],
          [DatasetContext.from_dataset(dataset_response.data)]
        )
      ).run
    end
  end
end
