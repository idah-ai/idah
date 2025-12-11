# frozen_string_literal: true

module Export
  class Service < Verse::Service::Base

    def export
    # "UniversalPortableDataset::Export"
    # infer api/setting/registry...
      Jobs::Service.new(auth_context).create(
        "Export::Job",
        arguments: {
          context_args: {},
          process_class: "UniversalPortableDataset::Export",
          process_args: {},
        }
      )
    end
  end
end
