# frozen_string_literal: true

require "spec_helper"
require_relative "../spec_data/storage_targets_helper"

RSpec.describe StorageTarget::Repository, database: true do
  include SpecData::StorageTargetsHelper

  describe "admin scope" do
    subject(:repo) { described_class.new(admin_context) }

    it "lists targets but not archived ones" do
      kept = create_target
      archived = create_target(enabled: false)
      repo.archive!(archived)

      expect(repo.index({}).map(&:id)).to eq([kept])
    end

    it "never puts the encrypted secret in a record" do
      record = repo.find!(create_target)

      expect(record.fields.keys).not_to include(:secret_ciphertext, :secret_access_key)
      expect(record.secret_hint).to eq("-123")
    end

    it "stores organization ids as integers" do
      id = create_target(organization_ids: [3, 7])

      expect(repo.find!(id).organization_ids).to eq([3, 7])
    end

    it "has no right to the credentials" do
      expect { repo.secret_ciphertext(create_target, action: :credentials) }.to raise_error(Verse::Error::Unauthorized)
    end
  end

  describe "#set_secret!" do
    it "publishes no event" do
      id = create_target
      published = []
      allow(Verse).to receive(:publish_resource_event) { |**opts| published << opts }

      described_class.new(admin_context).set_secret!(id, ciphertext: "v1:x:y:z", hint: "abcd")

      expect(published).to be_empty
    end
  end

  describe "#set_secret!, in the SQL log" do
    it "never prints the ciphertext, which logs plus the master key would turn back into the secret" do
      id = create_target
      log = StringIO.new
      logger = Logger.new(log)
      repo = described_class.new(admin_context)

      Verse::Plugin[:sequel].client(:rw) do |db|
        db.loggers << logger
        repo.set_secret!(id, ciphertext: "v1:CIPHERTEXT-CANARY:x:y", hint: "9999")
      ensure
        db.loggers.delete(logger)
      end

      expect(log.string).not_to include("CIPHERTEXT-CANARY")
      expect(repo.secret_ciphertext(id)).to eq("v1:CIPHERTEXT-CANARY:x:y")
      expect(repo.find!(id).secret_hint).to eq("9999")
    end

    it "still refuses a target the actor can't update" do
      id = create_target

      expect {
        described_class.new(org_owner_context([3])).set_secret!(id, ciphertext: "v1:a:b:c", hint: "x")
      }.to raise_error(Verse::Error::Unauthorized)
    end

    it "still raises for an unknown target" do
      expect {
        described_class.new(admin_context).set_secret!(UUIDv7.generate, ciphertext: "v1:a:b:c", hint: "x")
      }.to raise_error(Verse::Error::RecordNotFound)
    end
  end

  describe "#archive!" do
    it "disables the target, hides it, and publishes a deleted event" do
      id = create_target
      events = []
      allow(Verse).to receive(:publish_resource_event) { |**opts| events << opts[:event] }

      described_class.new(admin_context).archive!(id)

      record = described_class.new(system_context).find!(
        id,
        scope: described_class.new(system_context).scoped(:credentials)
      )
      expect(record.enabled).to be(false)
      expect(record.deleted_at).not_to be_nil
      expect(events).to include("deleted")
    end
  end

  describe "list_available" do
    def available(context)
      repo = described_class.new(context)
      repo.index({}, scope: repo.scoped(:list_available)).map(&:id)
    end

    let!(:for_org3) { create_target(organization_ids: [3]) }
    let!(:for_org7) { create_target(organization_ids: [7, 8]) }
    let!(:disabled) { create_target(organization_ids: [3], enabled: false) }

    it "gives an org owner the enabled targets allowed for one of their organizations" do
      expect(available(org_owner_context([3]))).to eq([for_org3])
      expect(available(org_owner_context([8, 9]))).to eq([for_org7])
    end

    it "gives an org owner nothing when no target allows their organizations" do
      expect(available(org_owner_context([42]))).to be_empty
    end

    it "gives an admin every enabled target" do
      expect(available(admin_context)).to contain_exactly(for_org3, for_org7)
    end

    it "leaves out archived targets" do
      repo = described_class.new(admin_context)
      repo.update!(for_org3, { enabled: false })
      repo.archive!(for_org3)

      expect(available(org_owner_context([3]))).to be_empty
    end
  end

  describe "credentials scope" do
    it "reaches archived targets, whose files stay readable" do
      id = create_target(enabled: false)
      described_class.new(admin_context).archive!(id)

      expect(described_class.new(system_context).secret_ciphertext(id, action: :credentials)).to start_with("v1:")
    end
  end
end
