# frozen_string_literal: true

require "spec_helper"

RSpec.describe AccountSettingsExpo, type: :exposition, as: :system do
  let(:now) { Time.now.utc }

  let(:account_setting_record) do
    AccountSetting::Record.new(
      {
        id: 1,
        account_id: 1,
        key: "theme",
        value: "dark",
        created_at: now,
        updated_at: now
      }
    )
  end

  let(:account_setting_data) do
    {
      data: {
        type: Resource::Setting::AccountSettings,
        id: "1",
        attributes: {
          account_id: 1,
          key: "theme",
          value: "dark"
        }
      }
    }
  end

  let(:service) { instance_double(AccountSettings::Service) }

  before do
    allow(AccountSettings::Service).to receive(:new).and_return(service)
  end

  it "list account settings" do
    expect(service).to receive(:index).and_return([account_setting_record])
    get "/account_settings"

    expect(last_response.status).to eq 200
    body = JSON.parse(last_response.body, symbolize_names: true)
    records = deserialize(body)

    expect(records[0].id).to eq "1"
    expect(records[0].account_id).to eq 1
    expect(records[0].key).to eq "theme"
    expect(records[0].value).to eq "dark"
  end

  it "show an account setting" do
    expect(service).to receive(:show).with(1, included: []).and_return(account_setting_record)
    get "/account_settings/1"

    expect(last_response.status).to eq 200
    body = JSON.parse(last_response.body, symbolize_names: true)
    record = deserialize(body)

    expect(record.id).to eq "1"
    expect(record.account_id).to eq 1
    expect(record.key).to eq "theme"
    expect(record.value).to eq "dark"
  end

  it "upserts an account setting by natural key" do
    expect(service).to receive(:upsert).with("theme", "dark", plugin: "").and_return(account_setting_record)

    post "/account_settings/upsert",
         {
           data: {
             type: Resource::Setting::AccountSettings,
             attributes: {
               key: "theme",
               value: "dark"
             }
           }
         }
    expect(last_response.status).to eq 200
  end

  it "passes the plugin through to the service" do
    expect(service).to receive(:upsert).with("label", "never", plugin: "idah-image").and_return(account_setting_record)

    post "/account_settings/upsert",
         {
           data: {
             type: Resource::Setting::AccountSettings,
             attributes: {
               key: "label",
               plugin: "idah-image",
               value: "never"
             }
           }
         }
    expect(last_response.status).to eq 200
  end

  describe "on account created" do
    it "creates account settings for the new account" do
      expect(service).to receive(:create).with("1")

      Verse.publish_resource_event(
        resource_type: "iam:accounts",
        resource_id: "1",
        event: "created",
        payload: {
          resource_id: "1",
        }
      )
    end
  end

  describe "on account deleted" do
    it "deletes account settings for the deleted account" do
      expect(service).to receive(:delete).with("1")

      Verse.publish_resource_event(
        resource_type: "iam:accounts",
        resource_id: "1",
        event: "deleted",
        payload: {
          resource_id: "1",
        }
      )
    end
  end
end
