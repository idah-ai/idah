# frozen_string_literal: true

module IdahVideo
  class Dataset
    def self.init(context)
      context.register_stats_generator("idah-video", IdahVideo::StatsGenerator)
    end

    def self.deinit(context)
      context.unmount_plugin
    end
  end
end
