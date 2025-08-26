# frozen_string_literal: true

require_relative "../lib/uuid_v7"

RSpec.describe UUIDv7 do
  describe "#generate" do
    it "generates a valid UUID v7" do
      uuid = UUIDv7.generate

      expect(uuid).to match(/\h{8}-\h{4}-7\h{3}-\h{4}-\h{12}/)
    end

    it "generates different UUIDs for different timestamps" do
      uuid1 = UUIDv7.generate(timestamp: Time.now.to_i * 1000)
      uuid2 = UUIDv7.generate(timestamp: (Time.now.to_i + 1) * 1000)

      expect(uuid1).not_to eq(uuid2)
    end
  end
end
