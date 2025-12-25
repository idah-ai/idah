# frozen_string_literal: true

require 'spec_helper'

RSpec.describe LogsExpo, type: :exposition, as: :system do
  let(:service) { instance_double(Log::Service) }

  before do
    allow(Log::Service).to receive(:new).and_return(service)
  end

  let(:uuid) { UUIDv7.generate }
  let(:event) { 'dataset:datasets:created' }
  let(:content) do
    {
      args: [],
      resource_id: uuid,
      metadata: {
        expo: 'DatasetsExpo',
        service: 'Dataset::Service',
        at: Time.now,
        account_id: 1
      }
    }
  end

  describe '#create_audit_log' do
    it 'created am audit log from event message' do
      expect(service).to(receive(:create_from_event).with(event, content))

      Verse.publish_resource_event(
        resource_type: 'dataset:datasets',
        resource_id: uuid,
        event: 'created',
        payload: content
      )
    end
  end
end
