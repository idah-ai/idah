# frozen_string_literal: true

class ExportExpo < BaseExpo
  http_path "/export"

  use_service Export::Service

  expose on_http(:get, "", auth: nil) do
    desc "export endpoint"
    input do
    end
  end
  def export_dataset
    service.export
  end
end
