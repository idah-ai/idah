# frozen_string_literal: true

class DatasetsExpo < BaseExpo
  http_path "/datasets"

  use_service Dataset::Service

  json_api Dataset::Record do
    show
    index
    create
    update
    delete
  end
end
