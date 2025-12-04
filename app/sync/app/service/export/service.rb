# frozen_string_literal: true

module Export
  class Service < Verse::Service::Base

    def export(dataset_id)
      Jobs::Service.new(auth_context).create(
        "Export::Job",
        arguments: {dataset_id:}
      )
    end
  end
end
