# frozen_string_literal: true

require "spec_helper"

RSpec.describe AccountSettings::Service, database: true do
  let(:auth_context) { Verse::Auth::Context.new(metadata: { id: account_id }) }

  subject { described_class.new(auth_context) }

  let(:account_settings_repo) { AccountSetting::Repository.new(auth_context) }

  let(:account_id) { 1 }
  let(:attributes) { { account_id: account_id, key: "theme", value: "dark" } }

  describe "#create" do
    it "creates default account settings for an account" do
      created_settings = subject.create(account_id)
      expect(created_settings.length).to be > 0
      expect(created_settings.all? { |s| s.account_id == account_id }).to be true
    end
  end

  describe "#index" do
    before do
      account_settings_repo.create(attributes)
    end

    it "lists all account settings" do
      settings = subject.index
      expect(settings.length).to be > 0
    end

    it "filters by account_id" do
      settings = subject.index({ account_id: account_id })
      expect(settings.all? { |s| s.account_id == account_id }).to be true
    end

    it "filters by key" do
      settings = subject.index({ key: "theme" })
      expect(settings.any? { |s| s.key == "theme" }).to be true
    end
  end

  describe "#show" do
    it "shows an account setting" do
      setting_id = account_settings_repo.create(attributes)

      found_setting = subject.show(setting_id)
      expect(found_setting.id.to_s).to eq(setting_id)
      expect(found_setting.key).to eq("theme")
    end
  end

  describe "#upsert" do
    it "creates the setting on first write and returns the record" do
      result = subject.upsert("theme", "dark")

      expect(result.account_id).to eq(account_id)
      expect(result.key).to eq("theme")
      expect(result.value).to eq("dark")
    end

    it "updates the same natural key on subsequent writes (no duplicate row)" do
      subject.upsert("theme", "dark")
      result = subject.upsert("theme", "light")

      expect(result.value).to eq("light")
      rows = account_settings_repo.index({ account_id: account_id, key: "theme" })
      expect(rows.length).to eq(1)
    end

    it "keeps rows independent per plugin" do
      subject.upsert("label", "a", plugin: "idah-image")
      subject.upsert("label", "b", plugin: "idah-video")

      expect(account_settings_repo.get("label", account_id: account_id, plugin: "idah-image")).to eq("a")
      expect(account_settings_repo.get("label", account_id: account_id, plugin: "idah-video")).to eq("b")
    end
  end

  describe "#delete" do
    it "deletes all account settings for an account" do
      account_settings_repo.create(attributes)
      account_settings_repo.create(account_id: account_id, key: "language", value: "en")

      subject.delete(account_id)

      settings = account_settings_repo.index({ account_id: account_id })
      expect(settings).to be_empty
    end
  end
end
