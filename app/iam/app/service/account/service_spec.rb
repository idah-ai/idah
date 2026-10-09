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

  context "As Admin", as: :admin do
    subject { described_class.new(current_auth_context) }

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

          expect_any_instance_of(Organization::Repository).to receive(:find!).and_return(
            Verse::JsonApi::Struct.new({ id: "999", name: "Test Organization" })
          )
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
              organization_id: "999",
              changed_by_name: "Admin User"
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
      before do
        @account_id = account_repo.create(attributes)
      end

      it "deletes an account that has not joined" do
        subject.delete(@account_id)

        expect { account_repo.find!(@account_id) }.to raise_error(Verse::Error::NotFound)
      end

      it "cannot delete an account that has already joined" do
        account_repo.update!(@account_id, { joined_at: Time.now })

        expect { subject.delete(@account_id) }.to raise_error(
          Verse::Error::Unauthorized,
          "Cannot delete an account that has already joined"
        )
      end
    end

    describe "#mark_as_joined" do
      context "when invitation has not expired" do
        it "marks an account as joined" do
          invitation_token = "token123"
          attributes.merge!(
            invitation_token:,
            invitation_expired_at: Time.now + 3 * 24 * 60 * 60
          )

          account_id = account_repo.create(attributes)

          subject.mark_as_joined(invitation_token)

          updated_account = account_repo.find!(account_id)
          expect(updated_account.joined_at).to eq(Time.now)
        end
      end

      context "when invitation has expired" do
        it "raises ValidationFailed error" do
          invitation_token = "token123"
          attributes.merge!(
            invitation_token:,
            invitation_expired_at: Time.now - 1
          )

          account_repo.create(attributes)

          expect {
            subject.mark_as_joined(invitation_token)
          }.to raise_error(Verse::Error::ValidationFailed, "Invitation has expired")
        end
      end

      context "when invitation token is nil" do
        it "raises ValidationFailed error" do
          invalid_token = "token123"
          attributes.merge!(
            invitation_token: nil, # Set to nil
            invitation_expired_at: Time.now - 1
          )

          account_repo.create(attributes)

          expect {
            subject.mark_as_joined(invalid_token)
          }.to raise_error(Verse::Error::RecordNotFound)
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
        expect_any_instance_of(Organization::Repository).to receive(:find!).and_return(
          Verse::JsonApi::Struct.new({ id: "111", name: "Test Organization" })
        )

        expect(::Service::Notification).to receive(:email).with(
          {
            to: "org_owner@test.com",
            recipient_account_email: "org_owner@test.com",
            title: "You have been removed as organization owner",
            category: "org_owner_role_removed",
            recipient_account_id: @org_owner_account.id,
            recipient_name: "Org Owner",
            changed_by_name: "Admin User",
            type: "notification:organization:activities",
            organization_id: "111",
            organization_name: "Test Organization",
            organization_scope_change: "added",
          }
        )

        # org_owner's org scope is added
        updating_record = deserialize(
          {
            data: {
              type: Resource::Iam::Accounts,
              id: @org_owner_account.id,
              attributes: { role_name: "user", role_scope: { org: ["999", "111"] } }
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
        expect_any_instance_of(Organization::Repository).to receive(:find!).and_return(
          Verse::JsonApi::Struct.new({ id: "111", name: "Organization 111" })
        )

        expect(::Service::Notification).to receive(:email).with(
          {
            to: "org_owner@test.com",
            recipient_account_email: "org_owner@test.com",
            title: "Your organization scope has been changed",
            category: "org_owner_role_assigned",
            recipient_account_id: @org_owner_account.id,
            recipient_name: "Org Owner",
            organization_scope_change: "added",
            organization_name: "Organization 111",
            organization_id: "111",
            changed_by_name: "Admin User",
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
        expect_any_instance_of(Organization::Repository).to receive(:find!).and_return(
          Verse::JsonApi::Struct.new({ id: "999", name: "org 999" })
        )

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
            changed_by_name: "Admin User",
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

    describe "#remove_org_from_account_role_scope" do
      before do
        @org_owner_account1 = subject.create(
          deserialize(
            {
              data: {
                type: Resource::Iam::Accounts,
                attributes: {
                  name: "Testing Org Owner 1",
                  email: "org_owner1@test.com",
                  role_name: "org_owner",
                  role_scope: { org: ["999"] }.to_json,
                  enabled: true,
                },
              }
            }
          )
        )
        @org_owner_account2 = subject.create(
          deserialize(
            {
              data: {
                type: Resource::Iam::Accounts,
                attributes: {
                  name: "Testing Org Owner 2",
                  email: "org_owner2@test.com",
                  role_name: "org_owner",
                  role_scope: { org: ["999", "111"] }.to_json,
                  enabled: true,
                },
              }
            }
          )
        )
      end

      it "removes the organization from the account role scope" do
        subject.remove_org_from_account_role_scope("999")

        expect(subject.show(@org_owner_account1.id).role_scope.to_json).to eq ({ "org": [] }).to_json
        expect(subject.show(@org_owner_account2.id).role_scope.to_json).to eq ({ "org": ["111"] }).to_json
      end
    end
  end

  describe "role assignment guard" do
    def account_record(attributes)
      deserialize(
        {
          data: {
            type: Resource::Iam::Accounts,
            attributes:,
          }
        }
      )
    end

    context "As an organization owner", as: :org_owner do
      subject { described_class.new(current_auth_context) }

      it "creates a user when no role is given (the invite flow)" do
        account = subject.create(
          account_record(name: "Invitee", email: "invitee@example.com", enabled: true)
        )
        expect(account.role_name).to eq("user")
      end

      it "allows assigning the user role" do
        account = subject.create(
          account_record(
            name: "Plain User",
            email: "plain-user@example.com",
            enabled: true,
            role_name: "user"
          )
        )
        expect(account.role_name).to eq("user")
      end

      it "allows assigning org_owner within its own organization scope" do
        account = subject.create(
          account_record(
            name: "Another Owner",
            email: "another-owner@example.com",
            enabled: true,
            role_name: "org_owner",
            role_scope: { org: ["1"] }.to_json
          )
        )
        expect(account.role_name).to eq("org_owner")
      end

      it "refuses assigning the admin role" do
        expect {
          subject.create(
            account_record(
              name: "Escalate",
              email: "escalate-admin@example.com",
              enabled: true,
              role_name: "admin"
            )
          )
        }.to raise_error(Verse::Error::Unauthorized)
      end

      it "refuses assigning the non-assignable system role" do
        expect {
          subject.create(
            account_record(
              name: "System",
              email: "escalate-system@example.com",
              enabled: true,
              role_name: "system"
            )
          )
        }.to raise_error(Verse::Error::Unauthorized)
      end

      it "refuses a role scoped to another organization" do
        expect {
          subject.create(
            account_record(
              name: "Cross Org",
              email: "cross-org@example.com",
              enabled: true,
              role_name: "org_owner",
              role_scope: { org: ["999"] }.to_json
            )
          )
        }.to raise_error(Verse::Error::Unauthorized)
      end

      it "refuses escalating an existing account to admin via update" do
        account = subject.create(
          account_record(
            name: "Later Admin",
            email: "later-admin@example.com",
            enabled: true,
            role_name: "user"
          )
        )

        updating = deserialize(
          {
            data: {
              type: Resource::Iam::Accounts,
              id: account.id,
              attributes: { role_name: "admin" }
            }
          }
        )

        expect { subject.update(updating) }.to raise_error(Verse::Error::Unauthorized)
      end
    end

    context "As an organization API key" do
      # API keys authenticate with a compound "api:<scopes>" role.
      subject do
        described_class.new(
          Verse::Auth::Context.from_role(
            "api:project_rw_org",
            custom_scopes: { org: ["1"] },
            metadata: { id: 99, role: :"api:project_rw_org" }
          )
        )
      end

      before do
        # Scoping accounts to the key's organization asks the dataset service
        # for its project members; stub that inter-service call.
        allow(Api[:idah].dataset.project_members).to receive(:index)
          .and_return(Verse::JsonApi::Struct.new([]))
      end

      it "allows inviting a regular user" do
        account = subject.create(
          account_record(
            name: "Invited User",
            email: "key-user@example.com",
            enabled: true,
            role_name: "user"
          )
        )
        expect(account.role_name).to eq("user")
      end

      it "allows inviting a user when no role is given" do
        account = subject.create(
          account_record(
            name: "Invited User",
            email: "key-default-user@example.com",
            enabled: true
          )
        )
        expect(account.role_name).to eq("user")
      end

      it "refuses creating an org_owner account" do
        expect {
          subject.create(
            account_record(
              name: "Key Owner",
              email: "key-owner@example.com",
              enabled: true,
              role_name: "org_owner",
              role_scope: { org: ["1"] }.to_json
            )
          )
        }.to raise_error(Verse::Error::Unauthorized)
      end

      it "refuses creating an admin account" do
        expect {
          subject.create(
            account_record(
              name: "Key Admin",
              email: "key-admin@example.com",
              enabled: true,
              role_name: "admin"
            )
          )
        }.to raise_error(Verse::Error::Unauthorized)
      end
    end

    # The inviting org owner is scoped to org "1" (see spec_helper). Here the
    # email it invites already belongs to an account in a *different* org (999),
    # which the inviter cannot see.
    context "when the email already belongs to an account in another organization", as: :org_owner do
      subject { described_class.new(current_auth_context) }

      # Created with the all-rights account_repo so the other-org account exists
      # regardless of the inviter's scope.
      def existing_account(role_name:, role_scope: {})
        id = account_repo.create(
          {
            name: "Existing Person",
            email: "existing@example.com",
            role_name:,
            role_scope: role_scope.to_json,
            enabled: true
          }
        )
        account_repo.find!(id)
      end

      def invite
        subject.create(
          account_record(name: "ignored", email: "existing@example.com", enabled: true)
        )
      end

      it "hides the role, scope and status when the email belongs to an admin elsewhere" do
        existing = existing_account(role_name: "admin", role_scope: { org: ["999"] })

        result = invite

        expect(result.id.to_s).to eq(existing.id.to_s)
        expect(result.name).to eq("Existing Person")
        expect(result.email).to eq("existing@example.com")
        expect(result.role_name).to be_nil
        expect(result.role_scope).to be_nil
        expect(result.enabled).to be_nil
      end

      it "hides the role and scope when the email belongs to an org owner of another organization" do
        existing_account(role_name: "org_owner", role_scope: { org: ["999"] })

        result = invite

        expect(result.role_name).to be_nil
        expect(result.role_scope).to be_nil
      end

      it "still returns the id and name so the person can be added to a project" do
        existing = existing_account(role_name: "user")

        result = invite

        expect(result.id.to_s).to eq(existing.id.to_s)
        expect(result.name).to eq("Existing Person")
      end

      it "does not modify the account in the other organization" do
        existing = existing_account(role_name: "admin", role_scope: { org: ["999"] })

        invite

        reloaded = account_repo.find!(existing.id)
        expect(reloaded.role_name).to eq("admin")
        expect(reloaded.role_scope).to eq({ "org" => ["999"] })
        expect(reloaded.email).to eq("existing@example.com")
      end

      it "does not create a second account for the same email" do
        existing = existing_account(role_name: "admin", role_scope: { org: ["999"] })

        invite

        matches = account_repo.index({ email: "existing@example.com" })
        expect(matches.map(&:id).map(&:to_s)).to eq([existing.id.to_s])
      end
    end

    # The inviting org owner is scoped to org "1" (see spec_helper, id 2). The
    # target already owns org "2", which the inviter does not. Adding the
    # inviter's org should union the scope to ["1", "2"].
    context "when an org owner adds their org to an owner of another org", as: :org_owner do
      subject { described_class.new(current_auth_context) }

      let!(:target_id) do
        account_repo.create(
          {
            name: "Foreign Owner",
            email: "foreign-owner@example.com",
            role_name: "org_owner",
            role_scope: { org: ["2"] }.to_json,
            enabled: true
          }
        )
      end

      before do
        # The scoped update reaches the target because it is a member of one of
        # the caller's projects; stub that inter-service lookup.
        member = Verse::JsonApi::Struct.new({ account_id: target_id })
        allow(Api[:idah].dataset.project_members).to receive(:index)
          .and_return(Verse::JsonApi::Struct.new([member]))
        # The role-change notification is covered elsewhere.
        allow_any_instance_of(Account::Repository).to receive(:after_commit)
      end

      def update_scope(orgs)
        subject.update(
          deserialize(
            {
              data: {
                type: Resource::Iam::Accounts,
                id: target_id,
                attributes: { role_scope: { org: orgs } }
              }
            }
          )
        )
      end

      it "unions the scope, keeping the organization the caller does not own" do
        updated = update_scope(["1", "2"])
        expect(updated.role_scope).to eq({ "org" => ["1", "2"] })
      end

      it "refuses removing an organization the caller does not own" do
        expect { update_scope(["1"]) }.to raise_error(Verse::Error::Unauthorized)
      end

      it "refuses adding an organization the caller does not own" do
        expect { update_scope(["2", "3"]) }.to raise_error(Verse::Error::Unauthorized)
      end

      it "leaves the scope unchanged when the change is refused" do
        expect { update_scope(["2", "3"]) }.to raise_error(Verse::Error::Unauthorized)
        expect(account_repo.find!(target_id).role_scope).to eq({ "org" => ["2"] })
      end
    end
  end
end
