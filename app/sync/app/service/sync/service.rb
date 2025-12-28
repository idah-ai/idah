# frozen_string_literal: true

module Sync
  class Service < Verse::Service::Base
    use_system jobs: Jobs::Service

    def export(filters)
    # "UniversalPortableDataset::Export"
    # infer api/setting/registry...

      auth_context.can!(:export, Jobs::Repository.resource) do |scope|
        scope.all? {jobs}
        scope.as_org_owner? {jobs}
        scope.as_user? {jobs}
      end.create(
        "Sync::Job",
        arguments: {
          auth_context:{
            role: auth_context.role,
            metadata: auth_context.metadata,
            custom_scopes: auth_context.custom_scopes
          },
          processors: {
            UniversalPortableDataset: {
              klass: "Export::UniversalPortableDataset",
              context: {
                idah: {
                  klass: "Context::Idah",
                  args: filters
                },
                io: {
                  klass: "Context::Io",
                  args: {
                    klass: "ExecutorCommand::UniversalPortableDatasetAppend"
                  }
                }
              }
            },
            CvatVideo:  {
              klass: "Export::CvatVideo",
              context: {
                idah: {
                  klass: "Context::Idah",
                  args: filters
                },
                io: {
                  klass: "Context::Io",
                  args: {
                    klass: "ExecutorCommand::CvatVideo"
                  }
                }
              }
            }
          }
        }
      )
    end
  end
end
