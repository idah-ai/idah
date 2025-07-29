# frozen_string_literal: true

module Video
  class Service < Verse::Service::Base
    # Start a video processing job.
    def process(arguments)
      job_service = Jobs::Service.new(auth_context)

      puts "Arguments = #{arguments.inspect}"

      job_service.create_job(
        "Video::Job",
        arguments:,
        unicity: "video:vp_#{arguments[:resource]}"
      )
    end
  end
end
