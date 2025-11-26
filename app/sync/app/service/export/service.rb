# frozen_string_literal: true
require 'duckdb'

module Export
  class Service < Verse::Service::Base

    def export(dataset_id)
      # create job in place
      Jobs::Service.new(auth_context).create(
        "Export::Job",
        arguments: {dataset_id:},
      )
    end
  end
end
