module IdahVideo
  def self.init(context)
    context.register_processor("idah_video", Processor::Video)
  end
end