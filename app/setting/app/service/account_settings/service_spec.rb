# frozen_string_literal: true

require "spec_helper"

RSpec.describe AccountSettings::Service, database: true do
  let(:auth_context) { Verse::Auth::Context.new }

  subject { described_class.new(auth_context) }

  let(:account_settings_repo) { AccountSetting::Repository.new(auth_context) }

  let(:test_account_id) { 1 }
  let(:test_key) { "test:setting:key" }
  let(:test_value) { "test_value" }
  let(:attributes) do
    {
      account_id: test_account_id,
      key: test_key,
      value: test_value
    }
  end

  describe "#index" do
    it "returns a list of account settings" do
      account_settings_repo.create(attributes)

      result = subject.index({ account_id: test_account_id })
      expect(result).to be_an(Verse::Util::ArrayWithMetadata)
      expect(result.first.account_id).to eq(test_account_id)
    end

    it "filters by account_id" do
      account_settings_repo.create(attributes)
      account_settings_repo.create(attributes.merge(account_id: 2))

      result = subject.index({ account_id: test_account_id })
      expect(result.size).to eq(1)
      expect(result.first.account_id).to eq(test_account_id)
    end
  end

  describe "#show" do
    it "shows a specific account setting" do
      setting_id = account_settings_repo.create(attributes)

      found_setting = subject.show(setting_id)
      expect(found_setting.id.to_s).to eq(setting_id)
      expect(found_setting.key).to eq(test_key)
    end
  end

  describe "#create" do
    it "creates default account settings for an account" do
      created_settings = subject.create(test_account_id)

      expect(created_settings).to be_an(Verse::Util::ArrayWithMetadata)
      expect(created_settings.size).to eq(AccountSettings::Defaults::DEFAULT_ACCOUNT_SETTINGS.size)

      created_settings.each do |setting|
        expect(setting.account_id).to eq(test_account_id)
        expect(AccountSettings::Defaults::DEFAULT_ACCOUNT_SETTINGS).to have_key(setting.key)
        expect(setting.value).to eq(AccountSettings::Defaults::DEFAULT_ACCOUNT_SETTINGS[setting.key])
      end
    end

    it "creates settings with correct keys and values" do
      created_settings = subject.create(test_account_id)

      notification_org = created_settings.find { |s| s.key == "notification:organization:activities" }
      notification_proj = created_settings.find { |s| s.key == "notification:project:activities" }

      expect(notification_org.value).to eq(true)
      expect(notification_proj.value).to eq(true)
    end
  end

  describe "#update" do
    it "updates an account setting" do
      setting_id = account_settings_repo.create(attributes)

      record = deserialize(
        {
          data: {
            type: Resource::Setting::AccountSettings,
            id: setting_id,
            attributes: {
              value: "updated_value"
            }
          }
        }
      )

      updated_setting = subject.update(record)
      expect(updated_setting.value).to eq("updated_value")
      expect(updated_setting.id.to_s).to eq(setting_id)
    end

    it "updates boolean values" do
      setting_id = account_settings_repo.create(
        account_id: test_account_id,
        key: "notification:organization:activities",
        value: true
      )

      record = deserialize(
        {
          data: {
            type: Resource::Setting::AccountSettings,
            id: setting_id,
            attributes: {
              value: false
            }
          }
        }
      )

      updated_setting = subject.update(record)
      expect(updated_setting.value).to eq(false)
    end
  end

  describe "#delete" do
    it "deletes all account settings for an account" do
      first_setting_id = account_settings_repo.create(attributes)
      second_setting_id = account_settings_repo.create(
        account_id: test_account_id,
        key: "another:key",
        value: "another_value"
      )

      subject.delete(test_account_id)

      expect { account_settings_repo.find!(first_setting_id) }.to raise_error(Verse::Error::NotFound)
      expect { account_settings_repo.find!(second_setting_id) }.to raise_error(Verse::Error::NotFound)
    end

    it "only deletes settings for the specified account" do
      first_setting_id = account_settings_repo.create(attributes)
      second_setting_id = account_settings_repo.create(attributes.merge(account_id: 2))

      subject.delete(test_account_id)

      expect { account_settings_repo.find!(first_setting_id) }.to raise_error(Verse::Error::NotFound)
      expect(account_settings_repo.find!(second_setting_id)).to be_truthy
    end
  end
end
