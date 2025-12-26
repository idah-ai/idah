# frozen_string_literal: true

module Export
  class Service < Verse::Service::Base
    use_system jobs: Jobs::Service

    def export(context_args)
    # "UniversalPortableDataset::Export"
    # infer api/setting/registry...

      auth_context.can!(:export, Jobs::Repository.resource) do |scope|
        scope.all? {jobs}
        scope.as_org_owner? {jobs}
        scope.as_user? {jobs}
      end.create(
        "Export::Job",
        arguments: {
          auth_context:{
            role: auth_context.role,
            metadata: auth_context.metadata,
            custom_scopes: auth_context.custom_scopes
          },
          io_classes: {
            UniversalPortableDataset: "Context::UniversalPortableDataset::Append",
            CvatVideo: "Context::Cvat::Video"
          },
          io_args: nil,
          context_args:,
          process_classes: {
            UniversalPortableDataset: "Export::UniversalPortableDataset",
            CvatVideo: "Export::CvatVideo"
          },
          process_args: nil
        }
      )
    end
  end
end
