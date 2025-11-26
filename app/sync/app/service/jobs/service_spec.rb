# frozen_string_literal: true

RSpec.describe Jobs::Service do
  let(:service) { described_class.new(Verse::Auth::Context[:system]) }

  describe "#create" do
    it "creates a job record" do
      repo = service.repo
      expect(repo).to receive(:transaction).and_yield
      expect(repo).to receive(:create).with(
        hash_including(
          job_class: "MyJob",
          arguments: { "a" => 1 },
          priority: 10,
          status: "pending",
          retry_count: 0,
          progress: 0.0
        )
      ).and_return(1)
      expect(repo).to receive(:find!).with(1)

      service.create(
        "MyJob",
        arguments: { "a" => 1 },
        priority: 10
      )
    end
  end
end
