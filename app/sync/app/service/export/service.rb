# frozen_string_literal: true

module Export
  class Service < Verse::Service::Base
    def export(context_args)
    # "UniversalPortableDataset::Export"
    # infer api/setting/registry...
      Jobs::Service.new(auth_context).create(
        "Export::Job",
        arguments: {
          file_class: "Context::UniversalPortableDataset::Append",
          context_args:,
          process_class: "Export::UniversalPortableDataset",
          process_args: {},}
      )
    end
  end
end
