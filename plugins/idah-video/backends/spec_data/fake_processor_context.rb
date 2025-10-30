# frozen_string_literal: true

class FakeProcessorContext
  attr_accessor :progress
  attr_reader :uploaded

  attr_reader :resource, :config, :job

  def initialize(
    file_path: "/tmp/fake_video.mp4",
    resource: "fake_resource",
    options: {}
  )
    @file_path = file_path
    @resource = resource
    @uploaded = []
    @config = IdahVideo::Processor::Options.new(options)
  end

  def download_original
    # Copy the file to a temporary directory, as the processor will delete it
    # after processing:
    return @copied_file if @copied_file

    tmpdir = Dir.mktmpdir
    FileUtils.cp(@file_path, tmpdir)
    @copied_file = File.join(tmpdir, File.basename(@file_path))
  end

  def upload_media(io, key, mime_type)
    @uploaded << { io:, key:, mime_type: }
  end

  def reschedule!(after: 10)
    @rescheduled_after = after
  end

  def error!(message)
    @error_message = message
  end
end
