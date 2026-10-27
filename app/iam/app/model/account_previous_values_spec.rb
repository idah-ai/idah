# frozen_string_literal: true

require "spec_helper"

RSpec.describe Account::Repository, database: true do
  subject(:accounts) { described_class.new(Verse::Auth::Context[:system]) }

  let!(:account_id) do
    accounts.no_event do
      accounts.create(
        name: "Owner",
        email: "owner-#{SecureRandom.hex(4)}@example.com",
        role_name: "org_owner",
        role_scope: { org: %w[1 2] }.to_json,
        enabled: true,
        hashed_password: "x"
      )
    end
  end

  def published_metadata
    metadata = nil
    allow(Verse).to receive(:publish_resource_event).and_wrap_original do |original, **args|
      metadata = args.dig(:payload, :metadata) if args[:event] == "updated"
      original.call(**args)
    end
    yield
    metadata
  end

  it "adds the account's previous role, scope and enabled flag to update events" do
    metadata = published_metadata do
      accounts.update!(account_id, { role_name: "user", role_scope: { org: [] }.to_json, enabled: false })
    end

    expect(metadata).to include(
      previous_role_name: "org_owner",
      previous_role_scope: { "org" => %w[1 2] },
      previous_enabled: true
    )
  end
end
