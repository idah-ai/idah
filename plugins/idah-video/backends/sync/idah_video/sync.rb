# frozen_string_literal: true

module IdahVideo
  # Entry point of the plugin in the sync service, called by the plugin system
  # at boot.
  class Sync
    def self.init(context)
      context.register_exports("idah-video", IdahVideo::Export::Coco)
    end
  end
end
