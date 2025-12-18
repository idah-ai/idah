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

  before do
    # freeze the time
    allow(Time).to receive(:now).and_return(
      Time.utc(2025, 1, 1, 0, 0, 0)
    )
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

    context "when updating role from user to org_owner" do
      before do
        expect_any_instance_of(Account::Repository).to receive(:after_commit).and_yield

        admin_id = account_repo.create(
          {
            name: "Admin User",
            email: "admin@test.com",
            role_name: "admin",
            role_scope: "{}",
            enabled: true,
          }
        )
        allow(auth_context).to receive(:metadata).and_return({ id: admin_id })

        allow_any_instance_of(Organization::Service).to receive(:show).with(999) do
          Verse::JsonApi::Struct.new(
            { id: 999,
              name: "Test Organization" }
          )
        end
      end

      it "updates role from user to org_owner and sends notification" do
        user_account = subject.create(
          deserialize(
            {
              data: {
                type: Resource::Iam::Accounts,
                attributes: {
                  name: "Regular User",
                  email: "user@test.com",
                  role_name: "user",
                  role_scope: "{}",
                  enabled: true,
                },
              }
            }
          )
        )

        expect(::Service::Notification).to receive(:email).with(
          {
            to: "user@test.com",
            recipient_account_email: "user@test.com",
            title: "You have been assigned as organization owner",
            category: "org_owner_role_assigned",
            type: "notification:organization:activities",
            recipient_account_id: user_account.id,
            recipient_name: "Regular User",
            organization_scope_change: "added",
            organization_name: "Test Organization",
            organization_id: 999,
            admin_name: "Admin User"
          }
        )

        record = deserialize(
          {
            data: {
              type: Resource::Iam::Accounts,
              id: user_account.id,
              attributes: {
                role_name: "org_owner",
                role_scope: { org: [999] }
              }
            }
          }
        )

        updated_account = subject.update(record)

        expect(updated_account.role_name).to eq("org_owner")

        expect(updated_account.role_scope).to eq({ "org" => [999] })
      end
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
  end

  describe "#mark_as_joined" do
    context "when invitation has not expired" do
      it "marks an account as joined" do
        attributes.merge!(
          invitation_expired_at: Time.now + 3 * 24 * 60 * 60
        )

        account_id = account_repo.create(attributes)

        subject.mark_as_joined(account_id)

        updated_account = account_repo.find!(account_id)
        expect(updated_account.joined_at).to eq(Time.now)
      end
    end

    context "when invitation has expired" do
      it "raises ValidationFailed error" do
        attributes.merge!(
          invitation_expired_at: Time.now - 1
        )

        account_id = account_repo.create(attributes)

        expect {
          subject.mark_as_joined(account_id)
        }.to raise_error(Verse::Error::ValidationFailed, "Invitation has expired")
      end
    end
  end

  describe "#resend_pending_invitations" do
    context "when account exists and has not joined" do
      it "resends the pending invitation" do
        attributes.merge!(
          joined_at: nil,
          invitation_expired_at: Time.now - 1
        )

        account_id = account_repo.create(attributes)

        subject.resend_pending_invitations(account_id)

        updated_account = account_repo.find!(account_id)
        expect(updated_account.invitation_expired_at).to eq(Time.now + 3 * 24 * 60 * 60)
      end
    end

    context "when account does not exist" do
      it "raises RecordNotFound error" do
        expect {
          subject.resend_pending_invitations(999)
        }.to raise_error(Verse::Error::RecordNotFound)
      end
    end

    context "when account has already joined" do
      it "raises NotFound error" do
        attributes.merge!(
          joined_at: Time.now - 1000
        )

        account_id = account_repo.create(attributes)

        expect {
          subject.resend_pending_invitations(account_id)
        }.to raise_error(Verse::Error::NotFound)
      end
    end
  end

  describe "#notify_role_change" do
    before do
      allow_any_instance_of(Account::Repository).to receive(:after_commit).and_yield

      admin_id = account_repo.create(
        {
          name: "Admin User",
          email: "admin@test.com",
          role_name: "admin",
          role_scope: "{}",
          enabled: true,
        }
      )
      allow(auth_context).to receive(:metadata).and_return({ id: admin_id })

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

      org_service_double = instance_double(Organization::Service)
      allow(Organization::Service).to receive(:new).and_return(org_service_double)
      allow(org_service_double).to receive(:show) do |org_id|
        Verse::JsonApi::Struct.new({ id: org_id, name: "org #{org_id}" })
      end

      @org_owner_account = subject.create(
        deserialize(
          {
            data: {
              type: Resource::Iam::Accounts,
              attributes: {
                name: "Org Owner",
                email: "org_owner@test.com",
                role_name: "org_owner",
                role_scope: '{"org": ["999"]}',
                enabled: true,
              },
            }
          }
        )
      )
    end

    it "notify role change" do
      expect(::Service::Notification).to receive(:email).with(
        {
          to: "org_owner@test.com",
          recipient_account_email: "org_owner@test.com",
          title: "You have been removed as organization owner",
          category: "org_owner_role_removed",
          recipient_account_id: @org_owner_account.id,
          recipient_name: "Org Owner",
          admin_name: "Admin User",
          type: "notification:organization:activities"
        }
      )

      # org_owner's org scope is added
      updating_record = deserialize(
        {
          data: {
            type: Resource::Iam::Accounts,
            id: @org_owner_account.id,
            attributes: { role_name: "user" }
          }
        }
      )
      subject.update(updating_record)
    end

    it "doesn't notify role change if the role doesn't change or org_owner's scope doesn't change" do
      expect(::Service::Notification).not_to receive(:email)

      # role doesn't change
      updating_record = deserialize(
        {
          data: {
            type: Resource::Iam::Accounts,
            id: @user_account.id,
            attributes: {
              name: "Updated Test Account Name"
            }
          }
        }
      )
      subject.update(updating_record)

      # org_owner's org scope doesn't change
      updating_record = deserialize(
        {
          data: {
            type: Resource::Iam::Accounts,
            id: @org_owner_account.id,
            attributes: {
              name: "Updated Test Account Name"
            }
          }
        }
      )
      subject.update(updating_record)
    end

    it "notify if org_owner's scope is added" do
      expect(::Service::Notification).to receive(:email).with(
        {
          to: "org_owner@test.com",
          recipient_account_email: "org_owner@test.com",
          title: "Your organization scope has been changed",
          category: "org_owner_role_assigned",
          recipient_account_id: @org_owner_account.id,
          recipient_name: "Org Owner",
          organization_scope_change: "added",
          organization_name: "org 111",
          organization_id: "111",
          admin_name: "Admin User",
          type: "notification:organization:activities"
        }
      )

      # org_owner's org scope is added
      updating_record = deserialize(
        {
          data: {
            type: Resource::Iam::Accounts,
            id: @org_owner_account.id,
            attributes: {
              role_scope: { org: ["999", "111"] }
            }
          }
        }
      )
      subject.update(updating_record)
    end

    it "notify if org_owner's scope is removed" do
      expect(::Service::Notification).to receive(:email).with(
        {
          to: "org_owner@test.com",
          recipient_account_email: "org_owner@test.com",
          title: "Your organization scope has been changed",
          category: "org_owner_role_assigned",
          recipient_account_id: @org_owner_account.id,
          recipient_name: "Org Owner",
          organization_scope_change: "removed",
          organization_name: "org 999",
          organization_id: "999",
          admin_name: "Admin User",
          type: "notification:organization:activities"
        }
      )

      # org_owner's org scope is added
      updating_record = deserialize(
        {
          data: {
            type: Resource::Iam::Accounts,
            id: @org_owner_account.id,
            attributes: {
              role_scope: { org: [] }
            }
          }
        }
      )
      subject.update(updating_record)
    end
  end
end
