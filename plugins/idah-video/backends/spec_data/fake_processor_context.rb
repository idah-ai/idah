class FakeProcessorContext
  attr_reader :uploaded, :progress

  def initialize(
    file_path: "/tmp/fake_video.mp4",
    resource: "fake_resource"
  )
    @file_path = file_path
    @uploaded = []
  end

  def download_original
    @file_path
  end

  def upload_media(io, key, mime_type)
    @uploaded << { io:, key:, mime_type: }
  end

  def progress=(value)
    @progress = value
  end

  def reschedule!(after: 10)
    @rescheduled_after = after
  end

  def error!(message)
    @error_message = message
  end
end
