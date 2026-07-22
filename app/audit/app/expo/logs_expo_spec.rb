# frozen_string_literal: true

require "spec_helper"

RSpec.describe LogsExpo, database: true do
  describe "event origin validation" do
    let(:service) { instance_double(Log::Service) }

    before do
      allow_any_instance_of(LogsExpo).to receive(:service).and_return(service)
    end

    context "when receiving events from trusted services" do
      it "processes iam:accounts:created event" do
        expect(service).to receive(:create_from_message) do |message:, **additional|
          expect(message.event).to eq("iam:accounts:created")
        end

        Verse.publish_resource_event(
          resource_type: Resource::Iam::Accounts,
          resource_id: "org-1",
          event: "created",
          payload: { resource_id: "org-1", metadata: { at: Time.now, actor_account_id: 1 } }
        )
      end

      it "processes dataset:projects:updated event" do
        expect(service).to receive(:create_from_message) do |message:, **additional|
          expect(message.event).to eq("dataset:projects:updated")
          expect(additional[:organization_id]).to eq(1)
          expect(additional[:project_id]).to eq("proj-1")
        end

        Verse.publish_resource_event(
          resource_type: Resource::Dataset::Projects,
          resource_id: "proj-1",
          event: "updated",
          payload: { resource_id: "proj-1", metadata: { at: Time.now, actor_account_id: 1, organization_id: 1 } }
        )
      end

      it "processes media:medias:deleted event" do
        expect(service).to receive(:create_from_message) do |message:, **additional|
          expect(message.event).to eq("media:medias:deleted")
          expect(additional[:resource_id]).to eq("media-1")
        end

        Verse.publish_resource_event(
          resource_type: Resource::Media::Medias,
          resource_id: "media-1",
          event: "deleted",
          payload: { resource_id: "media-1", metadata: { at: Time.now, actor_account_id: 1, media_resource: "media-1" } }
        )
      end
    end

    context "when event message has nil content" do
      it "skips the event (no metadata[:at] — nil content)" do
        expect(service).to receive(:create_from_message).and_return(nil)

        Verse.publish_resource_event(
          resource_type: Resource::Iam::Accounts,
          resource_id: "1",
          event: "created",
          payload: nil
        )
      end
    end

    context "when event message has nil metadata" do
      it "skips the event (no metadata[:at] — nil metadata)" do
        expect(service).to receive(:create_from_message).and_return(nil)

        Verse.publish_resource_event(
          resource_type: Resource::Iam::Accounts,
          resource_id: "1",
          event: "created",
          payload: { resource_id: "1", metadata: nil }
        )
      end
    end

    context "when event message has metadata without event_timestamp" do
      it "skips the event (metadata[:at] missing)" do
        expect(service).to receive(:create_from_message).and_return(nil)

        Verse.publish_resource_event(
          resource_type: Resource::Iam::Accounts,
          resource_id: "1",
          event: "created",
          payload: { resource_id: "1", metadata: { actor_account_id: 1 } }
        )
      end
    end

    context "with entry events" do
      it "skips entry event when actor_account_id is missing (background worker)" do
        expect(service).not_to receive(:create_from_message)

        Verse.publish_resource_event(
          resource_type: Resource::Dataset::Entries,
          resource_id: "entry-1",
          event: "created",
          payload: {
            resource_id: "entry-1",
            metadata: {
              at: Time.now,
              organization_id: 1,
              project_id: "proj-1",
              dataset_id: "ds-1"
            }
          }
        )
      end

      it "processes entry event when actor_account_id is present" do
        expect(service).to receive(:create_from_message)

        Verse.publish_resource_event(
          resource_type: Resource::Dataset::Entries,
          resource_id: "entry-1",
          event: "created",
          payload: {
            resource_id: "entry-1",
            metadata: {
              at: Time.now,
              actor_account_id: 1,
              organization_id: 1,
              project_id: "proj-1",
              dataset_id: "ds-1"
            }
          }
        )
      end
    end

    context "with media events" do
      it "skips media event when actor_account_id is missing (background worker)" do
        expect(service).not_to receive(:create_from_message)

        Verse.publish_resource_event(
          resource_type: Resource::Media::Medias,
          resource_id: "media-1",
          event: "created",
          payload: {
            resource_id: "media-1",
            metadata: { at: Time.now }
          }
        )
      end

      it "processes media event when actor_account_id is present" do
        expect(service).to receive(:create_from_message)

        Verse.publish_resource_event(
          resource_type: Resource::Media::Medias,
          resource_id: "media-1",
          event: "created",
          payload: {
            resource_id: "media-1",
            metadata: { at: Time.now, actor_account_id: 1, media_resource: "media-1" }
          }
        )
      end
    end

    context "with entry submitted events" do
      it "skips when submission_type is missing" do
        expect(service).not_to receive(:create_from_message)

        Verse.publish_resource_event(
          resource_type: Resource::Dataset::Entries,
          resource_id: "entry-1",
          event: "submitted",
          payload: {
            resource_id: "entry-1",
            metadata: { at: Time.now, actor_account_id: 1 }
          }
        )
      end

      it "processes when submission_type is present" do
        expect(service).to receive(:create_from_message) do |message:, **additional|
          expect(additional[:action]).to eq("review")
        end

        Verse.publish_resource_event(
          resource_type: Resource::Dataset::Entries,
          resource_id: "entry-1",
          event: "submitted",
          payload: {
            resource_id: "entry-1",
            metadata: {
              at: Time.now,
              actor_account_id: 1,
              submission_type: "review",
              organization_id: 1,
              project_id: "proj-1",
              dataset_id: "ds-1"
            }
          }
        )
      end
    end

    context "with account logged_in events" do
      it "sets action to logged_in when validation passes" do
        expect(service).to receive(:create_from_message) do |message:, **additional|
          expect(additional[:action]).to eq("logged_in")
        end

        Verse.publish_resource_event(
          resource_type: Resource::Iam::Accounts,
          resource_id: "1",
          event: "logged_in",
          payload: {
            resource_id: "1",
            metadata: { at: Time.now, actor_account_id: 1, validation: true }
          }
        )
      end

      it "sets action to failed_log_in_attempt when validation fails" do
        expect(service).to receive(:create_from_message) do |message:, **additional|
          expect(additional[:action]).to eq("failed_log_in_attempt")
        end

        Verse.publish_resource_event(
          resource_type: Resource::Iam::Accounts,
          resource_id: "1",
          event: "logged_in",
          payload: {
            resource_id: "1",
            metadata: { at: Time.now, actor_account_id: 1, validation: false }
          }
        )
      end

      it "sets action to failed_log_in_attempt when validation is missing" do
        expect(service).to receive(:create_from_message) do |message:, **additional|
          expect(additional[:action]).to eq("failed_log_in_attempt")
        end

        Verse.publish_resource_event(
          resource_type: Resource::Iam::Accounts,
          resource_id: "1",
          event: "logged_in",
          payload: {
            resource_id: "1",
            metadata: { at: Time.now, actor_account_id: 1 }
          }
        )
      end
    end
  end
end