# frozen_string_literal: true

require "spec_helper"

RSpec.describe AccountsExpo, type: :exposition, as: :system do
  let(:now) { Time.now.utc }

  let(:account_record) do
    Account::Record.new(
      {
        id: 1,
        name: "Test User",
        email: "test@example.com",
        enabled: true,
        joined_at: nil,
        created_at: now,
        updated_at: now
      }
    )
  end

  let(:account_data) do
    {
      data: {
        type: Resource::Iam::Accounts,
        id: "1",
        attributes: {
          name: "Test User",
          email: "test@example.com",
          enabled: true
        }
      }
    }
  end

  let(:service) { instance_double(Account::Service) }

  before do
    allow(Account::Service).to receive(:new).and_return(service)
  end

  it "list an accounts" do
    expect(service).to receive(:index).and_return([account_record])
    get "/accounts"

    expect(last_response.status).to eq 200
    body = JSON.parse(last_response.body, symbolize_names: true)
    records = deserialize(body)

    expect(records[0].id).to eq "1"
    expect(records[0].name).to eq "Test User"
    expect(records[0].email).to eq "test@example.com"
  end

  it "show an account" do
    expect(service).to receive(:show).with(1, included: []).and_return(account_record)
    get "/accounts/1"

    expect(last_response.status).to eq 200
    body = JSON.parse(last_response.body, symbolize_names: true)
    record = deserialize(body)

    expect(record.id).to eq "1"
    expect(record.name).to eq "Test User"
    expect(record.email).to eq "test@example.com"
  end

  it "create an account" do
    expect(service).to receive(:create).and_return(account_record)
    post "/accounts", account_data

    expect(last_response.status).to eq 201
    body = JSON.parse(last_response.body, symbolize_names: true)
    created_record = deserialize(body)

    expect(created_record.id).to eq "1"
    expect(created_record.name).to eq "Test User"
    expect(created_record.email).to eq "test@example.com"
  end

  it "update an account" do
    expect(service).to receive(:update) do |args|
      expect(args.id).to eq 1
      expect(args.attributes[:name]).to eq "Test User"
      expect(args.attributes[:email]).to eq nil # Email is readonly
      expect(args.attributes[:enabled]).to eq true
      account_record
    end

    patch "/accounts/1", account_data
    expect(last_response.status).to eq 200
  end

  it "delete an account" do
    expect(service).to receive(:delete).with(1).and_return(true)
    delete "/accounts/1"

    expect(last_response.status).to eq 204
  end

  it "mark account as joined" do
    expect(service).to receive(:mark_as_joined) do |id|
      expect(id).to eq "1"
    end

    patch "/accounts/1/join"

    expect(last_response.status).to eq 200
  end

  it "resend account invitation" do
    expect(service).to receive(:resend_pending_invitations) do |id|
      expect(id).to eq "1"
    end

    post "/accounts/1/resend_invitation"

    expect(last_response.status).to eq 200
  end
end
