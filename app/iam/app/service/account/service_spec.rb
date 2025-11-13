# frozen_string_literal: true

require "spec_helper"

RSpec.describe Account::Service, database: true do
  let(:auth_context){ Verse::Auth::Context.new }

  subject { described_class.new(auth_context) }

  let(:account_repo) { Account::Repository.new(auth_context) }

  let(:attributes) do
    {
      name: "Test Account Name",
      email: "test@example.com",
      enabled: true
    }
  end

  describe "#create" do
    it "creates a new account" do
      record = deserialize(
        {
          data: {
            type: Resource::Iam::Accounts,
            attributes:,
          }
        }
      )

      created_account = subject.create(record)
      expect(created_account.name).to eql("Test Account Name")
      expect(created_account.email).to eq("test@example.com")
      expect(created_account.enabled).to eq(true)
    end
  end

  describe "#show" do
    it "shows an account" do
      account_id = account_repo.create(attributes)

      found_account = subject.show(account_id)
      expect(found_account.id.to_s).to eq(account_id)
    end
  end

  describe "#update" do
    it "updates an account" do
      account_id = account_repo.create(attributes)

      record = deserialize(
        {
          data: {
            type: Resource::Iam::Accounts,
            id: account_id,
            attributes: {
              name: "Updated Test Account Name"
            }
          }
        }
      )

      updated_account = subject.update(record)
      expect(updated_account.name).to eq("Updated Test Account Name")
    end
  end

  describe "#delete" do
    it "deletes an account" do
      account_id = account_repo.create(attributes)
      subject.delete(account_id)
      expect { account_repo.find!(account_id) }.to raise_error(Verse::Error::NotFound)
    end
  end

  describe "#organization owner management" do
    before do
      @user_account = subject.create(
        deserialize(
          {
            data: {
              type: Resource::Iam::Accounts,
              attributes: {
                name: "User",
                email: "user@test.com",
                role_name: "user",
                role_scope: "{}",
                enabled: true,
              },
            }
          }
        )
      )
      @org_owner_account = subject.create(
        deserialize(
          {
            data: {
              type: Resource::Iam::Accounts,
              attributes: {
                name: "Org Owner",
                email: "org_owner@test.com",
                role_name: "org_owner",
                role_scope: '{"org": [999]}',
                enabled: true,
              },
            }
          }
        )
      )
      @another_org_owner_account = subject.create(
        deserialize(
          {
            data: {
              type: Resource::Iam::Accounts,
              attributes: {
                name: "Another Org Owner",
                email: "another_org_owner@test.com",
                role_name: "org_owner",
                role_scope: '{"org": [222, 999]}',
                enabled: true,
              },
            }
          }
        )
      )

      allow_any_instance_of(Organization::Service).to receive(:show).with(anything) do |org_id|
        Verse::JsonApi::Struct.new(
          { id: org_id,
            name: "org #{org_id}", }
        )
      end
    end

    describe "#add_owner" do
      it "adds a user as an org_owner and return the account" do
        expect(@user_account.role_name).to eq("user")
        expect(@user_account.role_scope["org"]).to be_nil.or be_empty

        account = subject.add_owner(org_id: 111, account_id: @user_account.id)

        expect(account.id).to eq(@user_account.id)
        expect(account.role_name).to eq("org_owner")
        expect(account.role_scope["org"].size).to eq(1)
        expect(account.role_scope["org"]).to include(111)
      end

      it "adds an organization id to scope if the account is already an org_owner and return the account" do
        expect(@org_owner_account.role_name).to eq("org_owner")
        expect(@org_owner_account.role_scope["org"]).not_to be_empty

        account = subject.add_owner(org_id: 111, account_id: @org_owner_account.id)

        expect(account.id).to eq(@org_owner_account.id)
        expect(account.role_name).to eq("org_owner")
        expect(account.role_scope["org"].size).to eq(2)
        expect(account.role_scope["org"]).to include(111)
      end

      it "just returns the account if it's already an org_owner and has the organization id, nothing changes" do
        expect(@another_org_owner_account.role_name).to eq("org_owner")
        expect(@another_org_owner_account.role_scope["org"]).to include(222)
        expect_any_instance_of(Account::Repository).not_to receive(:update!)

        account = subject.add_owner(org_id: 222, account_id: @another_org_owner_account.id)

        expect(account.id).to eq(@another_org_owner_account.id)
        expect(account.role_name).to eq("org_owner")
        expect(account.role_scope["org"].size).to eq(2)
      end
    end

    describe "#remove_owner" do
      it "removes an organization id from scope of an org_owner account" do
        expect(@another_org_owner_account.role_name).to eq("org_owner")
        expect(@another_org_owner_account.role_scope["org"]).not_to be_empty

        account = subject.remove_owner(org_id: 999, account_id: @another_org_owner_account.id)

        expect(account.id).to eq(@another_org_owner_account.id)
        expect(account.role_name).to eq("org_owner")
        expect(account.role_scope["org"].size).to eq(1)
      end

      it "removes an organization id from scope and turn the account into user if no org left in scope" do
        expect(@org_owner_account.role_name).to eq("org_owner")
        expect(@org_owner_account.role_scope["org"]).not_to be_empty

        account = subject.remove_owner(org_id: 999, account_id: @org_owner_account.id)

        expect(account.id).to eq(@org_owner_account.id)
        expect(account.role_name).to eq("user")
        expect(account.role_scope["org"]).to be_nil.or be_empty
      end

      it "just returns the account if it's just a user without any org scope" do
        expect(@user_account.role_name).to eq("user")
        expect(@user_account.role_scope["org"]).to be_nil.or be_empty
        expect_any_instance_of(Account::Repository).not_to receive(:update!)

        account = subject.remove_owner(org_id: 999, account_id: @user_account.id)

        expect(account.id).to eq(@user_account.id)
        expect(account.role_name).to eq("user")
      end
    end
  end
end
