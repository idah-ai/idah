# frozen_string_literal: true

module IdahImage
  # Entry point of the plugin in the sync service, called by the plugin system
  # at boot.
  class Sync
    def self.init(context)
      context.register_exports("idah-image", IdahImage::Export::Coco::Exporter)
      context.register_exports("idah-image", IdahImage::Export::Yolo::Exporter)
    end
  end
end
