# frozen_string_literal: true

module Sync
  class Service < Verse::Service::Base

    def sync(context_class, context_args, process_class, process_args, hooked = false)
      Jobs::Service.new(auth_context).create(
        "Sync::Job",
        arguments: {
          process_class:,
          process_args:,
          context_class:,
          context_args:,
          hooked:
        }
      )
    end
  end
end
