# frozen_string_literal: true

RSpec.describe Video::Service do
  let(:service) { described_class.new(Verse::Auth::Context[:system]) }

  describe "#process" do
    it "creates a job" do
      job_service = instance_double(Jobs::Service)
      expect(Jobs::Service).to receive(:new).and_return(job_service)

      arguments = { resource: "video_123" }
      expect(job_service).to receive(:create).with(
        "Video::Job",
        arguments:,
        unicity: "video:vp_video_123"
      )

      service.process(arguments)
    end
  end
end
