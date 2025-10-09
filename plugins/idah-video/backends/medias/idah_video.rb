module IdahVideo
  def init(context)
    context.register_processor("idah_video", VideoProcessor)
  end
end