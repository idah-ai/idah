# frozen_string_literal: true

class ProcessorExpo < BaseExpo
  expose on_resource_event(Resource::Dataset::Entries, :created) do
  end
  def process_entry_created
    service.process_entry_created(
      message.content[:resource_id]
    )
  end

end
