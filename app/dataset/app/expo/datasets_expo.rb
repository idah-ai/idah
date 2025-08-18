# frozen_string_literal: true

class DatasetsExpo < BaseExpo
  http_path "/datasets"

  use_service Dataset::Service

  json_api Dataset::Record, http_opts: { auth:nil } do
    show
    index
    create do
      authorized_relationships project: [:link]
    end
    update
    delete
  end
end
