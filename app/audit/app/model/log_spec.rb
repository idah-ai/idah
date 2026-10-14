# frozen_string_literal: true

require "spec_helper"

RSpec.describe Log, database: true do
  describe Log::Repository do
    subject { described_class.new(Verse::Auth::Context.new) }

    it "can be instantiated" do
      expect(subject).to be_a(Log::Repository)
    end

    # Use system context to create test data without scoping restrictions
    let(:system_auth_context) { Verse::Auth::Context[:system] }
    let(:repo) { described_class.new(system_auth_context) }

    let!(:log1) do
      repo.create(
        action: "created",
        actor_account_id: 1,
        actor_account_email: "admin@example.com",
        actor_account_role_name: "admin",
        resource_service: "iam",
        resource_type: "organizations",
        resource_id: "1",
        organization_id: 1,
        event_timestamp: Time.now
      )
    end

    let!(:log2) do
      repo.create(
        action: "updated",
        actor_account_id: 2,
        actor_account_email: "user@example.com",
        actor_account_role_name: "annotator",
        resource_service: "dataset",
        resource_type: "projects",
        resource_id: UUIDv7.generate,
        organization_id: 1,
        project_id: UUIDv7.generate,
        event_timestamp: Time.now
      )
    end

    describe "#scoped" do
      context "As Admin", as: :admin do
        subject { described_class.new(current_auth_context) }

        it "returns all logs for :read action" do
          result = subject.scoped(:read).all

          expect(result.size).to eq(2)
          expect(result.map { |r| r[:action] }).to match_array(%w[created updated])
        end
      end

      context "As non-admin user", as: :user do
        subject { described_class.new(current_auth_context) }

        it "raises an error when trying to read logs" do
          expect { subject.scoped(:read).all }.to raise_error(Verse::Error::Unauthorized)
        end
      end
    end
  end
end
