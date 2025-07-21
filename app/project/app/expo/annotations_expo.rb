# frozen_string_literal: true

class AnnotationsExpo < BaseExpo
  http_path "/annotations"

  use_service Annotation::Service

  json_api Annotation::Record do
    show
    index
    create
    update
    delete
  end
end
