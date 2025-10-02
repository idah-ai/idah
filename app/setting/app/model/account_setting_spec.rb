# frozen_string_literal: true

RSpec.describe AccountSetting, database: true do
  describe AccountSetting::Repository do
    subject { described_class.new(Verse::Auth::Context.new) }

    let(:user_account_id) { 123 }
    let(:other_user_account_id) { 456 }

    context "#get" do
      it "returns the value of a account_setting" do
        subject.set("test_key", "test_value", account_id: user_account_id)
        expect(subject.get("test_key", account_id: user_account_id)).to eq("test_value")
      end

      it "returns the default value if the key does not exist" do
        expect(subject.get("non_existent_key", default: "default_value", account_id: user_account_id)).to eq("default_value")
      end

      it "returns nil if the key does not exist and no default is provided" do
        expect(subject.get("non_existent_key", account_id: user_account_id)).to be_nil
      end

      it "returns nil for a different user" do
        subject.set("test_key", "test_value", account_id: user_account_id)
        expect(subject.get("test_key", account_id: other_user_account_id)).to be_nil
      end

      it "can return various data types" do
        subject.set("hash_key", { a: 1 }, account_id: user_account_id)
        subject.set("array_key", [1, 2], account_id: user_account_id)
        subject.set("int_key", 123, account_id: user_account_id)
        subject.set("float_key", 1.23, account_id: user_account_id)
        subject.set("bool_key", true, account_id: user_account_id)
        subject.set("nil_key", nil, account_id: user_account_id)

        expect(subject.get("hash_key", account_id: user_account_id)).to eq({ a: 1 })
        expect(subject.get("array_key", account_id: user_account_id)).to eq([1, 2])
        expect(subject.get("int_key", account_id: user_account_id)).to eq(123)
        expect(subject.get("float_key", account_id: user_account_id)).to eq(1.23)
        expect(subject.get("bool_key", account_id: user_account_id)).to be(true)
        expect(subject.get("nil_key", account_id: user_account_id)).to be_nil
      end

      it "can handle plugins" do
        subject.set("plugin_key", "plugin_value", account_id: user_account_id, plugin: "my_plugin")
        expect(subject.get("plugin_key", account_id: user_account_id, plugin: "my_plugin")).to eq("plugin_value")
        expect(subject.get("plugin_key", account_id: user_account_id)).to be_nil
      end
    end

    context "#set" do
      it "creates a new account_setting" do
        subject.set("new_key", "new_value", account_id: user_account_id)
        expect(subject.get("new_key", account_id: user_account_id)).to eq("new_value")
      end

      it "updates an existing account_setting" do
        subject.set("existing_key", "initial_value", account_id: user_account_id)
        subject.set("existing_key", "updated_value", account_id: user_account_id)
        expect(subject.get("existing_key", account_id: user_account_id)).to eq("updated_value")
      end

      it "can set various data types" do
        subject.set("hash_key", { a: 1 }, account_id: user_account_id)
        subject.set("array_key", [1, 2], account_id: user_account_id)
        subject.set("int_key", 123, account_id: user_account_id)
        subject.set("float_key", 1.23, account_id: user_account_id)
        subject.set("bool_key", true, account_id: user_account_id)
        subject.set("nil_key", nil, account_id: user_account_id)

        expect(subject.get("hash_key", account_id: user_account_id)).to eq({ a: 1 })
        expect(subject.get("array_key", account_id: user_account_id)).to eq([1, 2])
        expect(subject.get("int_key", account_id: user_account_id)).to eq(123)
        expect(subject.get("float_key", account_id: user_account_id)).to eq(1.23)
        expect(subject.get("bool_key", account_id: user_account_id)).to be(true)
        expect(subject.get("nil_key", account_id: user_account_id)).to be_nil
      end

      it "can create settings for different users" do
        subject.set("some_key", "user_1_value", account_id: user_account_id)
        subject.set("some_key", "user_2_value", account_id: other_user_account_id)

        expect(subject.get("some_key", account_id: user_account_id)).to eq("user_1_value")
        expect(subject.get("some_key", account_id: other_user_account_id)).to eq("user_2_value")
      end
    end

  end
end
