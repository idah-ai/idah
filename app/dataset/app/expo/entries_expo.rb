# frozen_string_literal: true

class EntriesExpo < BaseExpo
  http_path "/entries"

  use_service Entry::Service

  json_api Entry::Record, http_opts: { auth:nil } do
    show
    index
    create
    update
    delete
  end
end
