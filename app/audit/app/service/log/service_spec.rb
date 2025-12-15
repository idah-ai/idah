# frozen_string_literal: true

require "spec_helper"

RSpec.describe Log::Service, database: true do
  let(:auth_context) { Verse::Auth::Context[:system] }
  subject { described_class.new(auth_context) }

  let(:repo) { Log::Repository.new(auth_context) }

  let(:event) { "dataset:datasets:created" }
  let(:content) {
    {
      args: [],
      resource_id: UUIDv7.generate,
      metadata: {
        expo: "DatasetsExpo",
        service: "Dataset::Service",
        at: Time.now,
        account_id: 1,
      }
    }
  }

  describe "#create" do
    it "creates an audit log" do
      log = subject.create(event, content)

      expect(log.action).to eq "created"
      expect(log.resource_service).to eq "dataset"
      expect(log.resource_type).to eq "datasets"
      expect(log.resource_id).to eq content[:resource_id]
      expect(log.actor_account_id).to eq 1
    end
  end

  describe "#show" do
    before do
      @log1 = subject.create(event, content)
    end

    it "show an audit log" do
      log = subject.show(@log1.id)

      expect(log.action).to eq "created"
      expect(log.resource_service).to eq "dataset"
      expect(log.resource_type).to eq "datasets"
      expect(log.resource_id).to eq content[:resource_id]
      expect(log.actor_account_id).to eq 1
    end
  end

  describe "#index" do
    before do
      subject.create(event, content)
      subject.create(event, content)
    end

    it "list audit logs" do
      logs = subject.index({})

      expect(logs.size).to eq 2
    end
  end
end
