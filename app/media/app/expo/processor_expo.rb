# frozen_string_literal: true

class ProcessorExpo < BaseExpo
  use_service Processor::Service

  puts "WE EXPOSE HERE OR WHAT?"
  expose on_resource_event(Resource::Dataset::Entries, "created")
  def on_entry_created
    pp({on_entry_created: {params:}})
    service.process_entry(
      params[:resource_id]
    )
  end
end
