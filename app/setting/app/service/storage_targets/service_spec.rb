# frozen_string_literal: true

require "spec_helper"
require_relative "../../spec_data/storage_targets_helper"

RSpec.describe StorageTargets::Service, database: true do
  include SpecData::StorageTargetsHelper

  subject(:service) { described_class.new(admin_context) }

  let(:secret) { SpecData::StorageTargetsHelper::SECRET }

  let(:connection_test) { instance_double(StorageTargets::ConnectionTest, call: nil) }

  before { allow(StorageTargets::ConnectionTest).to receive(:new).and_return(connection_test) }

  # What the JSON:API create and update routes pass: the sent attributes only.
  def input(attributes, id: nil)
    double("input", attributes:, id:)
  end

  let(:new_target) do
    {
      name: "Acme bucket",
      endpoint: "https://s3.example.com",
      region: "eu-west-1",
      bucket: "acme-bucket",
      prefix: "/idah/",
      access_key_id: "AKIANEW",
      secret_access_key: secret,
      organization_ids: %w[3 7],
      enabled: true
    }
  end

  def stored_secret(id)
    SecretBox.from_env.decrypt(
      StorageTarget::Repository.new(system_context).secret_ciphertext(
        id,
        action: :credentials
      )
    )
  end

  describe "#create" do
    it "tests the connection, then stores the target with its secret encrypted" do
      expect(connection_test).to receive(:call).with(
        endpoint: "https://s3.example.com",
        region: "eu-west-1",
        bucket: "acme-bucket",
        prefix: "idah",
        path_style: false,
        access_key_id: "AKIANEW",
        secret_access_key: secret
      ).and_return(nil)

      record = service.create(input(new_target))

      expect(record).to have_attributes(
        name: "Acme bucket",
        prefix: "idah",
        organization_ids: [3, 7],
        enabled: true,
        created_by: 1
      )
      expect(stored_secret(record.id)).to eq(secret)
    end

    it "refuses the target when the connection test fails, and stores nothing" do
      allow(connection_test).to receive(:call).and_return("access_denied")

      expect { service.create(input(new_target)) }.to raise_error(Verse::Error::ValidationFailed, /access_denied/)
      expect(service.index({})).to be_empty
    end

    it "requires the location and the credentials" do
      expect {
        service.create(input(new_target.except(:bucket, :secret_access_key)))
      }.to raise_error(Verse::Error::ValidationFailed, /bucket.*secret_access_key/)
      expect(connection_test).not_to have_received(:call)
    end

    it "tests and stores path-style addressing, which self-hosted S3 services need" do
      record = service.create(input(new_target.merge(path_style: true)))

      expect(connection_test).to have_received(:call).with(hash_including(path_style: true))
      expect(record.path_style).to be(true)
    end

    it "is disabled and allowed for no organization unless told otherwise" do
      record = service.create(input(new_target.except(:enabled, :organization_ids)))

      expect(record).to have_attributes(enabled: false, organization_ids: [])
    end

    it "never sends the secret with the events it publishes" do
      payloads = []
      allow(Verse).to receive(:publish_resource_event) { |**opts| payloads << opts }

      service.create(input(new_target))

      expect(payloads).not_to be_empty
      expect(payloads.inspect).not_to include(secret)
    end

    it "refuses an org owner without testing anything" do
      owner = described_class.new(org_owner_context([3]))

      expect { owner.create(input(new_target)) }.to raise_error(Verse::Error::Unauthorized)
      expect(connection_test).not_to have_received(:call)
    end
  end

  describe "#update" do
    let!(:id) { create_target(organization_ids: [3]) }

    it "changes the name, organizations and status without testing the connection" do
      record = service.update(input({ name: "Renamed", organization_ids: ["9"], enabled: false }, id:))

      expect(record).to have_attributes(name: "Renamed", organization_ids: [9], enabled: false)
      expect(connection_test).not_to have_received(:call)
    end

    it "keeps the stored secret when none is sent" do
      service.update(input({ name: "Renamed" }, id:))

      expect(stored_secret(id)).to eq(secret)
    end

    it "tests a new secret against the stored location, then stores it" do
      expect(connection_test).to receive(:call).with(
        endpoint: "https://s3.example.com",
        region: "eu-west-1",
        bucket: "customer-bucket",
        prefix: "acme",
        path_style: false,
        access_key_id: "AKIAEXAMPLE",
        secret_access_key: "NEW-SECRET-9876"
      ).and_return(nil)

      service.update(input({ secret_access_key: "NEW-SECRET-9876" }, id:))

      expect(stored_secret(id)).to eq("NEW-SECRET-9876")
    end

    it "keeps the old secret when the new one fails the test" do
      allow(connection_test).to receive(:call).and_return("access_denied")

      expect {
        service.update(input({ secret_access_key: "NEW-SECRET-9876" }, id:))
      }.to raise_error(Verse::Error::ValidationFailed, /access_denied/)
      expect(stored_secret(id)).to eq(secret)
    end

    it "retests with the stored secret when the addressing changes, then saves it" do
      record = service.update(input({ path_style: true }, id:))

      expect(connection_test).to have_received(:call).with(hash_including(path_style: true, secret_access_key: secret))
      expect(record.path_style).to be(true)
    end

    it "needs the secret that goes with a new access key id" do
      expect {
        service.update(input({ access_key_id: "AKIAOTHER" }, id:))
      }.to raise_error(Verse::Error::ValidationFailed, /secret_access_key/)
    end

    it "tests and stores a new key pair" do
      service.update(input({ access_key_id: "AKIAOTHER", secret_access_key: "OTHER-SECRET-0000" }, id:))

      expect(connection_test).to have_received(:call).with(hash_including(access_key_id: "AKIAOTHER"))
      expect(service.show(id).access_key_id).to eq("AKIAOTHER")
    end

    it "refuses a change of location, which would cut off the files already stored" do
      expect {
        service.update(input({ bucket: "another-bucket" }, id:))
      }.to raise_error(Verse::Error::ValidationFailed, /bucket/)
    end

    it "accepts the location fields when they are unchanged, as a form sends them back" do
      record = service.update(input({ bucket: "customer-bucket", prefix: "/acme/", name: "Same place" }, id:))

      expect(record.name).to eq("Same place")
    end

    it "flags a secret change in the event, without the secret" do
      payloads = []
      allow(Verse).to receive(:publish_resource_event) { |**opts| payloads << opts }

      service.update(input({ secret_access_key: "NEW-SECRET-9876" }, id:))

      updated = payloads.find { |p| p[:event] == "updated" }
      expect(updated.dig(:payload, :metadata, :secret_changed)).to be(true)
      expect(payloads.inspect).not_to include("NEW-SECRET-9876")
    end
  end

  describe "#delete" do
    it "refuses to archive an enabled target" do
      id = create_target(enabled: true)

      expect { service.delete(id) }.to raise_error(Verse::Error::ValidationFailed, /disable/i)
    end

    it "archives a disabled target" do
      id = create_target(enabled: false)

      service.delete(id)

      expect { service.show(id) }.to raise_error(Verse::Error::RecordNotFound)
    end
  end

  describe "#test_connection" do
    it "tests values that are not saved yet" do
      allow(connection_test).to receive(:call).and_return("bucket_not_found")

      expect(service.test_connection(new_target)).to eq({ ok: false, error: "bucket_not_found" })
    end

    it "tests a saved target with its stored secret" do
      id = create_target

      expect(service.test_saved(id)).to eq({ ok: true, error: nil })
      expect(connection_test).to have_received(:call).with(hash_including(secret_access_key: secret))
    end

    it "is for admins only" do
      expect {
        described_class.new(org_owner_context([3])).test_connection(new_target)
      }.to raise_error(Verse::Error::Unauthorized)
    end
  end

  describe "#available" do
    it "keeps only the targets allowing the given organization" do
      for_three = create_target(organization_ids: [3, 4])
      create_target(organization_ids: [4])

      expect(described_class.new(org_owner_context([3, 4])).available(organization_id: 3).map(&:id)).to eq([for_three])
    end

    it "lists the targets an org owner may pick, without credentials" do
      id = create_target(organization_ids: [3])
      create_target(organization_ids: [4])

      targets = described_class.new(org_owner_context([3])).available

      expect(targets.map(&:id)).to eq([id])
      expect(targets.first).to be_a(StorageTarget::Summary)
      expect(targets.first.fields.keys).to contain_exactly(:id, :name, :endpoint, :bucket)
    end
  end

  describe "#credentials" do
    it "gives the system role the location and the decrypted secret" do
      id = create_target

      credentials = described_class.new(system_context).credentials(id)

      expect(credentials).to have_attributes(
        id:,
        bucket: "customer-bucket",
        prefix: "acme",
        path_style: false,
        access_key_id: "AKIAEXAMPLE",
        secret_access_key: secret
      )
      expect(credentials.inspect).not_to include(secret)
    end

    it "serves an archived target, whose files stay readable" do
      id = create_target(enabled: false)
      service.delete(id)

      expect(described_class.new(system_context).credentials(id).secret_access_key).to eq(secret)
    end

    it "is refused to an admin" do
      expect { service.credentials(create_target) }.to raise_error(Verse::Error::Unauthorized)
    end
  end
end
