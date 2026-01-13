# frozen_string_literal: true

module Exports
  class Service < Verse::Service::Base
    use exports: Exports::Repository

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
    def create(job_id, filename, file, metadata)
      Verse::Plugin[:shrine].with_storage do |storage|
        output = storage.upload(file)
        # metadata = auth_context.metadata
        id = output.id
        puts({auth_context:, metadata:})
        exports.create(
          {
            id:,
            job_id:,
            filename:,
            size: output.size,
            mime_type: output.mime_type || "application/octet-stream", # for now
            created_by: metadata[:id] || auth_context[:id],
            created_role: metadata[:role] || auth_context[:role],
          }
        )
        exports.find!(id)
      end
    end

  end
end
