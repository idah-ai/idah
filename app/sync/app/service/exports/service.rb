# frozen_string_literal: true

module Exports
  class Service < Verse::Service::Base
    use exports: Exports::Repository
    use_system system_jobs: Jobs::Service

    def index(filter = {}, included: [], page: 1, items_per_page: 1000, sort: nil, query_count: false)
      exports.index(
        filter,
        included: included,
        page: page,
        items_per_page: items_per_page,
        sort: sort,
        query_count: query_count
      )
    end

    def show(id)
      exports.find!(id)
    end

    # TODO: check who can delete ? only system ?
    def delete(id)
      file = exports.find!(id)
      exports.delete(file.id)
    end

    # system only!
    def create(job_id, filename, file, organization, metadata, custom_scopes)
      Verse::Plugin[:shrine].with_storage do |storage|
        output = storage.upload(file)
        # metadata = auth_context.metadata
        id = output.id
        exports.create(
          {
            id:,
            job_id:,
            filename:,
            size: output.size,
            mime_type: output.mime_type || "application/octet-stream", # for now
            created_by: metadata[:id],
            created_by_role: metadata[:role],
            created_by_organization: organization,
            created_by_metadata: metadata,
            created_by_custom_scopes: custom_scopes

          }
        )
        exports.find!(id)
      end
    end

    def export(filters)
    # "UniversalPortableDataset::Export"
    # infer api/setting/registry...

      auth_context.can!(:request_export, exports.class.resource) do |scope|
        scope.all? {system_jobs}
        scope.as_org_owner? {system_jobs}
        scope.as_user? {system_jobs}
      end.create(
        "Jobs::Export",
        created_by: {
          id: auth_context.metadata[:id],
          role: auth_context.role,
          organization: case auth_context.role
                                    when "admin"
                                      nil
                                    when "org_owner"
                                      auth_context.custom_scopes.fetch(:org)
                                    when "user"
                                      raise "todo"
                                    else
                                      raise "unexpected created_by_auth_context: #{created_by_auth_context}"
                                    end,
          custom_scopes: auth_context.custom_scopes,
          metadata: auth_context.metadata,
        },
        arguments: {
          filters:,
          # opts: nil,
          formats: {
            "UniversalPortableDataset":{
              # **opts
            },
            "Cvat":{
              # **opts
            }
          }
        }
      )
    end
  end
end
