# frozen_string_literal: true

module Export
  class Service < Verse::Service::Base
    def export(context_args)
    # "UniversalPortableDataset::Export"
    # infer api/setting/registry...
      Jobs::Service.new(auth_context).create(
        "Export::Job",
        arguments: {
          io_classes: {
            # UniversalPortableDataset: "Context::UniversalPortableDataset::Append",
            CvatVideo: "Context::Cvat::Video"
          },
          io_args: {},
          context_args:,
          # process_class: "Export::UniversalPortableDataset",
          process_class: "Export::CvatVideo",
          process_args: nil
        }
      )
    end
  end
end
