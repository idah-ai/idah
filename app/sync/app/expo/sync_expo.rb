# frozen_string_literal: true

class ExportExpo < BaseExpo
  http_path "/sync"

  use_service Export::Service

  expose on_http(:get, "/:dataset_id", auth: nil) do
    desc "Synchronisation endpoint"
    input do
      field :dataset_id, String
    end
  end
  def export_dataset
    test_export
  end

  # test while waiting for API definition
  private
    def test_export(dataset_id)
      context_args = {
        name: [:export, dataset_id, Time.now.to_i],
        datasets: [dataset_id]
      }

      [
        service.sync(
          "IdahContext::Root",
          {},
          "UniversalPortableDatasetProcess::Sync",
          {},
          true
        ),
        service.sync(
          "IdahContext::Root",
          {},
          "JsonlProcess::Sync",
          {},
          true
        ),
        service.sync(
          "IdahContext::Root",
          {},
          "UniversalPortableDatasetProcess::Sync",
          {}
        ),
        service.sync(
          "IdahContext::Root",
          {},,
          "JsonlProcess::Sync",
          {}
        )
      ]

    # exemple for import
    #     Jobs::Service.new(auth_context).create(
    #       "Sync::Job",
    #       arguments: {
    #         process_class: "IdahProcess::Sync",
    #         process_args:,
    #         context_class:,
    #         context_args:,
    #         sync_on_hook: false
    #       }
    #     )

    end
end
