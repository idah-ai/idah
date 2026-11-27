# frozen_string_literal: true

require "spec_helper"

# StorageRegistry::EvictionExpo lives in common/lib; it is specced here.
RSpec.describe StorageRegistry::EvictionExpo do
  let(:target_id) { "0194f5a2-0000-7000-8000-000000000001" }

  def expo_for(method_name, content)
    message = double("message", content:, headers: {})
    described_class.new(Verse::Auth::Context[:system], method_name, nil, message:)
  end

  it "subscribes in broadcast mode, so every media and sync process evicts" do
    bus = described_class.on_resource_broadcast(Resource::Setting::StorageTargets, "updated")

    expect(bus.type).to eq(Verse::Event::Manager::MODE_BROADCAST)
  end

  %i[on_storage_target_updated on_storage_target_deleted].each do |method|
    it "#{method} evicts the target" do
      expect(StorageRegistry).to receive(:evict).with(target_id)

      expo_for(method, { resource_id: target_id, metadata: {} }).public_send(method)
    end
  end

  it "ignores an event without a target id" do
    expect(StorageRegistry).not_to receive(:evict)

    expo_for(:on_storage_target_updated, { metadata: {} }).on_storage_target_updated
  end

  it "is registered by the media service" do
    routes = File.read(File.expand_path("../../config/routes.rb", __dir__))

    expect(routes).to include("StorageRegistry::EvictionExpo")
  end
end
