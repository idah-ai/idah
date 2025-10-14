# frozen_string_literal: true

class ProcessorExpo < BaseExpo
  use_service Processor::Service

  expose on_resource_event(Resource::Dataset::Entries, :created)
  def on_entry_created
    service.process_entry(
      params[:resource_id]
    )
  end

end
