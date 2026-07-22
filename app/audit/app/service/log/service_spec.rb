# frozen_string_literal: true

require "spec_helper"

RSpec.describe Log::Service, database: true do
  subject(:service) { described_class.new(auth_context) }

  let(:auth_context) { Verse::Auth::Context[:system] }
  let(:system_auth_context) { Verse::Auth::Context[:system] }
  let(:repo) { Log::Repository.new(system_auth_context) }

  let(:valid_attributes) do
    {
      action: "created",
      actor_account_id: 1,
      actor_account_email: "admin@example.com",
      actor_account_role_name: "admin",
      resource_service: "iam",
      resource_type: "organizations",
      resource_id: "1",
      organization_id: 1,
      event_timestamp: Time.now
    }
  end

  let(:valid_message) do
    instance_double(
      Verse::Event::Message,
      event: "iam:organizations:created",
      content: {
        resource_id: "1",
        metadata: {
          at: Time.now,
          actor_account_id: 1,
          actor_account_email: "admin@example.com",
          actor_account_role_name: "admin"
        }
      }
    )
  end

  describe "#create" do
    it "creates a log record" do
      record = service.create(valid_attributes)

      expect(record[:action]).to eq("created")
      expect(record[:resource_service]).to eq("iam")
      expect(record[:resource_type]).to eq("organizations")
      expect(record[:actor_account_id]).to eq(1)
    end
  end

  describe "#create_from_message" do
    it "creates a log record from an event message" do
      record = service.create_from_message(message: valid_message)

      expect(record[:action]).to eq("created")
      expect(record[:resource_service]).to eq("iam")
      expect(record[:resource_type]).to eq("organizations")
      expect(record[:actor_account_id]).to eq(1)
    end

    it "merges additional attributes" do
      record = service.create_from_message(
        message: valid_message,
        organization_id: 1,
        project_id: "proj-1"
      )

      expect(record[:organization_id]).to eq(1)
      expect(record[:project_id]).to eq("proj-1")
    end

    context "when message content is nil" do
      let(:nil_content_message) do
        instance_double(
          Verse::Event::Message,
          event: "iam:accounts:created",
          content: nil
        )
      end

      it "returns nil and does not create a record" do
        expect do
          result = service.create_from_message(message: nil_content_message)
          expect(result).to be_nil
        end.not_to change { repo.index({}).size }
      end
    end

    context "when message metadata is nil" do
      let(:nil_metadata_message) do
        instance_double(
          Verse::Event::Message,
          event: "iam:accounts:created",
          content: { resource_id: "1", metadata: nil }
        )
      end

      it "returns nil and does not create a record" do
        expect do
          result = service.create_from_message(message: nil_metadata_message)
          expect(result).to be_nil
        end.not_to change { repo.index({}).size }
      end
    end

    context "when event_timestamp is missing" do
      let(:missing_timestamp_message) do
        instance_double(
          Verse::Event::Message,
          event: "iam:accounts:created",
          content: { resource_id: "1", metadata: { actor_account_id: 1 } }
        )
      end

      it "returns nil and does not create a record" do
        expect do
          result = service.create_from_message(message: missing_timestamp_message)
          expect(result).to be_nil
        end.not_to change { repo.index({}).size }
      end
    end

    context "when an error occurs" do
      let(:error_message) do
        instance_double(
          Verse::Event::Message,
          event: "iam:accounts:created",
          content: { resource_id: "1", metadata: { at: "invalid_time" } }
        )
      end

      it "catches the exception and returns nil" do
        expect(Verse.logger).to receive(:error).at_least(:once)
        result = service.create_from_message(message: error_message)
        expect(result).to be_nil
      end
    end
  end

  describe "#index" do
    let(:auth_context) { Verse::Auth::Context.new }
    let!(:log_record) { repo.create(valid_attributes) }

    context "As admin", as: :admin do
      let(:auth_context) { current_auth_context }

      it "returns logs" do
        result = service.index({})
        expect(result.size).to eq 1
      end
    end
  end

  describe "#show" do
    let(:auth_context) { Verse::Auth::Context[:system] }
    let!(:log_record) { repo.create(valid_attributes).to_i }

    it "returns a log by id" do
      result = service.show(log_record)
      expect(result[:id]).to eq(log_record)
    end
  end
end
