# frozen_string_literal: true

RSpec.describe Setting, database: true do
  describe Setting::Repository do
    subject { described_class.new(Verse::Auth::Context.new) }

    context "#get" do
      it "returns the value of a setting" do
        subject.set("test_key", "test_value")
        expect(subject.get("test_key")).to eq("test_value")
      end

      it "returns the default value if the key does not exist" do
        expect(subject.get("non_existent_key", default: "default_value")).to eq("default_value")
      end

      it "returns nil if the key does not exist and no default is provided" do
        expect(subject.get("non_existent_key")).to be_nil
      end

      it "can return various data types" do
        subject.set("hash_key", { a: 1 })
        subject.set("array_key", [1, 2])
        subject.set("int_key", 123)
        subject.set("float_key", 1.23)
        subject.set("bool_key", true)
        subject.set("nil_key", nil)

        expect(subject.get("hash_key")).to eq({ a: 1 })
        expect(subject.get("array_key")).to eq([1, 2])
        expect(subject.get("int_key")).to eq(123)
        expect(subject.get("float_key")).to eq(1.23)
        expect(subject.get("bool_key")).to be(true)
        expect(subject.get("nil_key")).to be_nil
      end
    end

    context "#set" do
      it "creates a new setting" do
        subject.set("new_key", "new_value")

        expect(subject.get("new_key")).to eq("new_value")
      end

      it "updates an existing setting" do
        subject.set("existing_key", "initial_value")
        subject.set("existing_key", "updated_value")

        expect(subject.get("existing_key")).to eq("updated_value")
      end

      it "can set various data types" do
        subject.set("hash_key", { a: 1 })
        subject.set("array_key", [1, 2])
        subject.set("int_key", 123)
        subject.set("float_key", 1.23)
        subject.set("bool_key", true)
        subject.set("nil_key", nil)

        expect(subject.get("hash_key")).to eq({ a: 1 })
        expect(subject.get("array_key")).to eq([1, 2])
        expect(subject.get("int_key")).to eq(123)
        expect(subject.get("float_key")).to eq(1.23)
        expect(subject.get("bool_key")).to be(true)
        expect(subject.get("nil_key")).to be_nil
      end
    end
  end
end
