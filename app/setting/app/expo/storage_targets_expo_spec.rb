# frozen_string_literal: true

require "spec_helper"
require_relative "../spec_data/storage_targets_helper"

# Runs the real service and database: only the S3 probe is stubbed, so the
# responses checked for the secret are the ones a client would get.
RSpec.describe StorageTargetsExpo, type: :exposition, database: true do
  include SpecData::StorageTargetsHelper

  let(:secret) { SpecData::StorageTargetsHelper::SECRET }
  let(:connection_test) { instance_double(StorageTargets::ConnectionTest, call: nil) }

  before { allow(StorageTargets::ConnectionTest).to receive(:new).and_return(connection_test) }

  def body
    JSON.parse(last_response.body, symbolize_names: true)
  end

  def create_payload(**attributes)
    {
      data: {
        type: Resource::Setting::StorageTargets,
        attributes: {
          name: "Acme bucket",
          endpoint: "https://s3.example.com",
          region: "eu-west-1",
          bucket: "acme-bucket",
          prefix: "idah",
          access_key_id: "AKIANEW",
          secret_access_key: secret,
          organization_ids: [3],
          enabled: true,
          **attributes
        }
      }
    }
  end

  context "as an admin", as: :admin do
    it "creates a target and answers with nothing of the secret" do
      post "/storage_targets", create_payload

      expect(last_response.status).to eq(201)
      expect(body.dig(:data, :attributes)).to include(name: "Acme bucket", organization_ids: [3])
      expect(body.dig(:data, :attributes)).not_to include(:secret_access_key, :secret_hint)
      expect(last_response.body).not_to include(secret)
    end

    it "ignores columns the service sets, such as the author" do
      post "/storage_targets", create_payload(created_by: 99)

      expect(body.dig(:data, :attributes)).to include(created_by: 1)
    end

    it "refuses a target that fails the connection test" do
      allow(connection_test).to receive(:call).and_return("access_denied")

      post "/storage_targets", create_payload

      expect(last_response.status).to eq(422)
      expect(last_response.body).to include("access_denied")
      expect(last_response.body).not_to include(secret)
    end

    it "lists and shows targets without their secret" do
      id = create_target

      get "/storage_targets"
      expect(body[:data].map { |d| d[:id] }).to eq([id])
      expect(last_response.body).not_to include(secret)

      get "/storage_targets/#{id}"
      expect(body.dig(:data, :attributes, :bucket)).to eq("customer-bucket")
      expect(last_response.body).not_to include(secret)
    end

    it "lists the targets with the given ids, for the audit log page" do
      wanted = [create_target(name: "Wanted A"), create_target(name: "Wanted B")]
      create_target(name: "Other")

      get "/storage_targets?#{wanted.map { |id| "filter[id__in][]=#{id}" }.join("&")}"
      expect(last_response.status).to eq(200)
      expect(body[:data].map { |d| d[:id] }).to match_array(wanted)
    end

    it "updates the name and refuses a new bucket" do
      id = create_target

      patch "/storage_targets/#{id}", { data: { type: Resource::Setting::StorageTargets, id:, attributes: { name: "Renamed" } } }
      expect(last_response.status).to eq(200)
      expect(body.dig(:data, :attributes, :name)).to eq("Renamed")

      patch "/storage_targets/#{id}", { data: { type: Resource::Setting::StorageTargets, id:, attributes: { bucket: "other" } } }
      expect(last_response.status).to eq(422)
    end

    it "archives a disabled target" do
      id = create_target(enabled: false)

      delete "/storage_targets/#{id}"

      expect(last_response.status).to eq(204)
      get "/storage_targets/#{id}"
      expect(last_response.status).to eq(404)
    end

    it "tests unsaved values" do
      allow(connection_test).to receive(:call).and_return("bucket_not_found")

      post "/storage_targets/_test",
           {
             endpoint: "https://s3.example.com",
             bucket: "acme-bucket",
             access_key_id: "AKIANEW",
             secret_access_key: secret
           }

      expect(last_response.status).to eq(200)
      expect(body[:data]).to eq({ ok: false, error: "bucket_not_found" })
    end

    it "tests a saved target" do
      post "/storage_targets/#{create_target}/_test"

      expect(body[:data]).to eq({ ok: true, error: nil })
    end

    it "lists every enabled target as available" do
      id = create_target(organization_ids: [8])

      get "/storage_targets/_available"

      expect(body[:data].map { |d| d[:id] }).to eq([id])
    end

    it "can't read credentials" do
      get "/storage_targets/#{create_target}/_credentials"

      expect(last_response.status).to eq(403)
      expect(last_response.body).not_to include(secret)
    end
  end

  context "as an org owner of organization 3", as: :org_owner do
    it "sees only the available targets allowed for organization 3, without credentials" do
      mine = create_target(organization_ids: [3])
      create_target(organization_ids: [4])

      get "/storage_targets/_available"

      expect(last_response.status).to eq(200)
      expect(body[:data].map { |d| d[:id] }).to eq([mine])
      expect(body[:data].first[:attributes].keys).to contain_exactly(:name, :endpoint, :bucket)
    end

    it "narrows the available targets to one organization" do
      create_target(organization_ids: [3])

      get "/storage_targets/_available?organization_id=4"

      expect(last_response.status).to eq(200)
      expect(body[:data]).to be_empty
    end

    it "can't list, create, test or read credentials" do
      id = create_target(organization_ids: [3])

      get "/storage_targets"
      expect(last_response.status).to eq(403)

      post "/storage_targets", create_payload
      expect(last_response.status).to eq(403)

      post "/storage_targets/#{id}/_test"
      expect(last_response.status).to eq(403)

      get "/storage_targets/#{id}/_credentials"
      expect(last_response.status).to eq(403)
      expect(last_response.body).not_to include(secret)
    end
  end

  context "as the system role", as: :system do
    it "reads a target's credentials" do
      id = create_target

      get "/storage_targets/#{id}/_credentials"

      expect(last_response.status).to eq(200)
      expect(body.dig(:data, :attributes)).to include(
        bucket: "customer-bucket", prefix: "acme", access_key_id: "AKIAEXAMPLE", secret_access_key: secret
      )
    end
  end
end
