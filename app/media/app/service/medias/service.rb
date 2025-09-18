# frozen_string_literal: true

module Medias
  class Service < Verse::Service::Base
    use medias: Medias::Repository
    use_system video_service: Video::Service

    def index(filter = {}, included: [], page: 1, items_per_page: 1000, sort: nil, query_count: false)
      medias.index(
        filter,
        included: included,
        page: page,
        items_per_page: items_per_page,
        sort: sort,
        query_count: query_count
      )
    end

    def show(resource, key, included: [])
      medias.find_by!({ resource:, key: }, included:)
    end

    def delete(resource, key)
      file = medias.find_by!({ resource:, key: })
      medias.delete(file.id)
    end

    def create(record)
      medias.transaction do
        record_id = medias.create(record.attributes)
        medias.find!(record_id)
      end
    end

    def upload(file, resource:, key: "")
      Verse::Plugin[:shrine].with_storage do |storage|
        # Verify that the resource/key combination is not already used:
        existing = medias.find_by({ resource:, key: })

        if existing
          raise Verse::Error::ValidationFailed,
                "Resource #{resource} with key #{key} already exists"
        end

        # Upload the file to the storage:
        output = storage.upload(
          file.tempfile
        )

        metadata = auth_context.metadata

        id = output.id

        medias.create(
          {
            id:,
            resource:,
            filename: file.filename || resource,
            key:,
            size: output.size,
            mime_type: output.mime_type || "application/octet-stream",
            created_by: metadata[:id],
            created_role: metadata[:role]&.to_s
          }
        )
        medias.find!(id)
      end
    end
  end
end
