# frozen_string_literal: true

module Sync
  class Service < Verse::Service::Base
    use_system system_jobs: Jobs::Service

    def export(filters)
    # "UniversalPortableDataset::Export"
    # infer api/setting/registry...

      auth_context.can!(:export, Jobs::Repository.resource) do |scope|
        scope.all? {system_jobs}
        scope.as_org_owner? {system_jobs}
        scope.as_user? {system_jobs}
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
                api: {
                  klass: "Context::ContextApi",
                  context: filters,
                },
                io: {
                  klass: "Context::Io",
                  opts: {
                    klass: "Command::UniversalPortableDataset"
                  }
                }
              }
            },
            Cvat:  {
              klass: "Export::Cvat",
              context: {
                api: {
                  klass: "Context::ContextApi",
                  context: filters,
                },
                io: {
                  klass: "Context::Io",
                  opts: {
                    klass: "Command::Cvat"
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
