module IdahVideo
  def self.init(context)
    binding.pry
    context.register_processor("idah_video", Processor::Video)
  end
end