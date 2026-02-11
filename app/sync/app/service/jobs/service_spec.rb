# frozen_string_literal: true

RSpec.describe Jobs::Service do
  let(:auth_context) do
    Verse::Auth::Context[:system]
  end

  let(:service) { described_class.new(auth_context) }
  let(:repo) { service.repo }

  describe "#create" do
    it "creates a job record" do
      expect(repo).to receive(:transaction).and_yield
      expect(repo).to receive(:create).with(
        hash_including(
          arguments: {"a" => 1},
          job_class: "MyJob",
          priority: 10,
          progress: 0.0,
          retry_count: 0,
          scheduled_at: kind_of(Time),
          status: "pending",
          unicity: nil
        )
      ).and_return(1)
      expect(repo).to receive(:find!).with(1)

      service.create(
        "MyJob",
        created_by: auth_context.metadata,
        arguments: { "a" => 1 },
        priority: 10
      )
    end
  end

  # Add tests for index, show, delete, update
  describe "#index" do
    it "calls repo.index" do
      expect(repo).to receive(:index)
      service.index
    end
  end

  describe "#show" do
    it "calls repo.find!" do
      expect(repo).to receive(:find!).with(1, included: [])
      service.show(1)
    end
  end

  describe "#delete" do
    it "calls repo.delete" do
      expect(repo).to receive(:delete).with(1)
      service.delete(1)
    end
  end

  describe "#update" do
    it "calls repo.update!" do
      record = double("record", id: 1, attributes: { "a" => 1 })
      expect(repo).to receive(:update!).with(1, { "a" => 1 })
      expect(repo).to receive(:find!).with(1)
      service.update(record)
    end
  end
end
