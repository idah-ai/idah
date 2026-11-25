# frozen_string_literal: true

require "spec_helper"

RSpec.describe Account::Service, database: true do
  let(:system_context) { Verse::Auth::Context[:system] }
  let(:system_repo) { Account::Repository.new(system_context) }

  def build_context(role, scopes: {}, id: 1, email: "actor@test.com", name: "Actor", rights: nil)
    # Build from the role so rights come from common/data/roles/*.yml via the
    # real RoleBackend (set on boot), not a hardcoded list. `rights` overrides
    # when a spec needs a specific right set.
    if rights
      Verse::Auth::Context.new(
        rights,
        role: role,
        custom_scopes: scopes,
        metadata: { id:, email:, name:, role: role.to_sym }
      )
    else
      Verse::Auth::Context.from_role(
        role,
        custom_scopes: scopes,
        metadata: { id:, email:, name:, role: role.to_sym }
      )
    end
  end

  def build_record(attrs)
    data = {
      type: Resource::Iam::Accounts,
      attributes: attrs.reject { |k, _| k == :id }
    }
    data[:id] = attrs[:id] if attrs[:id]

    Verse::JsonApi::Struct.new(data)
  end

  def create_account(attrs)
    attrs = attrs.dup
    attrs[:role_scope] = attrs[:role_scope].to_json if attrs.key?(:role_scope)
    system_repo.create(attrs)
  end

  let(:base_attrs) do
    { name: "Test User", email: "test@example.com", enabled: true }
  end

  before do
    allow(Time).to receive(:now).and_return(Time.utc(2025, 1, 1, 0, 0, 0))

    # The org_owner read scope resolves co-members through the dataset service;
    # the inter-service client needs a bearer token. Override the auth provider
    # with a fixed token so the real client code runs without a service-account
    # login round-trip.
    Api[:idah].add_auth(:bearer) do |request|
      request["Authorization"] = "Bearer test-token"
    end
  end

  # Stubs the dataset project_members HTTP calls that the org_owner read scope
  # makes through ProjectMembership::Lookup. `account_ids` are the members the
  # lookup returns for the actor's orgs; the actor's own memberships return none.
  def stub_org_owner_read_scope(account_ids: [])
    stub_request(:get, %r{dataset/project_members}).
      with { |req| CGI.unescape(req.uri.query.to_s).include?("filter[organization_id__in]") }.
      to_return(
        status: 200,
        body: JSON.generate(
          data: account_ids.map do |id|
            { type: "dataset:project_members", id: "pm#{id}", attributes: { account_id: id } }
          end
        ),
        headers: { "Content-Type" => "application/json" }
      )
    stub_request(:get, %r{dataset/project_members}).
      with { |req| CGI.unescape(req.uri.query.to_s).include?("filter[account_id]") }.
      to_return(status: 200, body: JSON.generate(data: []), headers: { "Content-Type" => "application/json" })
  end

  describe "#create (system-only)" do
    context "as system" do
      subject { described_class.new(build_context("system")) }

      it "creates a new account" do
        created = subject.create(build_record(base_attrs))
        expect(created.name).to eq("Test User")
        expect(created.email).to eq("test@example.com")
        expect(created.enabled).to eq(true)
        expect(subject.auth_context.checked?).to be(true)
      end

      it "returns an existing account by email instead of creating a duplicate" do
        create_account(base_attrs)
        created = subject.create(build_record(base_attrs))
        expect(created.email).to eq("test@example.com")
      end

      it "rejects non-assignable roles" do
        expect {
          subject.create(build_record(base_attrs.merge(role_name: "system")))
        }.to raise_error(Verse::Error::ValidationFailed)
      end
    end

    context "as admin" do
      subject { described_class.new(build_context("admin")) }

      it "allows direct creation (admin has full rights, like system)" do
        created = subject.create(build_record(base_attrs))
        expect(created.email).to eq("test@example.com")
      end
    end

    context "as org_owner" do
      subject { described_class.new(build_context("org_owner", scopes: { org: ["1"] }, id: 2)) }

      it "rejects direct creation (system only)" do
        expect {
          subject.create(build_record(base_attrs))
        }.to raise_error(Verse::Error::Unauthorized, /Only system/)
      end
    end
  end

  describe "#invite" do
    context "as admin" do
      subject { described_class.new(build_context("admin")) }

      it "accepts a plain attribute hash (as the expo passes params)" do
        created = subject.invite({ email: "hash@test.com", role_name: "user" })
        expect(created.email).to eq("hash@test.com")
        expect(created.role_name).to eq("user")
      end

      it "creates a new account with the invited role" do
        created = subject.invite(build_record(base_attrs.merge(role_name: "org_owner", role_scope: { org: ["1"] })))
        expect(created.role_name).to eq("org_owner")
        expect(created.role_scope).to eq("org" => ["1"])
        expect(subject.auth_context.checked?).to be(true)
      end

      it "emits iam:accounts:created carrying the inviter's id" do
        captured = []
        allow(Verse).to receive(:publish_resource_event) do |**opts|
          captured << [opts[:event], opts[:payload][:metadata]]
        end

        subject.invite(build_record(base_attrs.merge(email: "invitee@test.com", role_name: "user")))

        created = captured.find { |event, _| event == "created" }
        expect(created).not_to be_nil
        expect(created[1]).to include(actor_account_id: 1, actor_account_email: "actor@test.com")
      end

      it "runs the write on a plain system context (no actor identity in the write context)" do
        # The system service that performs the write must NOT carry the inviter's
        # identity in its auth context — only the event metadata does.
        system_ctx = nil
        allow_any_instance_of(Account::Service).to receive(:create) do |svc, *_args|
          system_ctx = svc.auth_context
          nil
        end

        subject.invite(build_record(base_attrs.merge(email: "invitee@test.com", role_name: "user")))

        expect(system_ctx).not_to be_nil
        expect(system_ctx.metadata[:id]).to be_nil
      end

      it "creates a plain user account" do
        created = subject.invite(build_record(base_attrs))
        expect(created.role_name).to eq("user")
      end

      it "cannot invite with a role ranked above admin (system)" do
        expect {
          subject.invite(build_record(base_attrs.merge(role_name: "system")))
        }.to raise_error(Verse::Error::Unauthorized)
      end

      it "rejects an invite without an email (as the org-owners modal would send)" do
        expect {
          subject.invite(build_record(base_attrs.merge(email: "")))
        }.to raise_error(Verse::Error::ValidationFailed, /email is required/)
      end

      context "invite on an existing email" do
        it "grants the requested org as-is (admin is unrestricted)" do
          create_account(base_attrs.merge(email: "owner@test.com", role_name: "org_owner", role_scope: { org: ["2"] }))
          updated = subject.invite(
            build_record(
              base_attrs.merge(
                email: "owner@test.com",
                role_name: "org_owner",
                role_scope: { org: ["999"] }
              )
            )
          )
          expect(updated.role_scope).to eq("org" => %w[2 999])
        end

        it "emits iam:accounts:updated carrying the inviter's id on expansion" do
          create_account(base_attrs.merge(email: "owner@test.com", role_name: "user"))
          captured = []
          allow(Verse).to receive(:publish_resource_event) do |**opts|
            captured << [opts[:event], opts[:payload][:metadata]]
          end

          subject.invite(
            build_record(base_attrs.merge(email: "owner@test.com", role_name: "org_owner", role_scope: { org: ["1"] }))
          )

          updated = captured.find { |event, _| event == "updated" }
          expect(updated).not_to be_nil
          expect(updated[1]).to include(actor_account_id: 1, actor_account_email: "actor@test.com")
        end

        it "rejects inviting a disabled account with a specific message (readable)" do
          create_account(base_attrs.merge(email: "disabled@test.com", enabled: false))
          expect {
            subject.invite(build_record(base_attrs.merge(email: "disabled@test.com")))
          }.to raise_error(Verse::Error::Unauthorized, /re-enable/)
        end
      end
    end

    # Project invites call the IAM invite with the service (system) token and
    # role_name "user". An existing admin/org_owner email must be left unchanged.
    context "as system (project invite)" do
      subject { described_class.new(build_context("system")) }

      it "keeps an admin unchanged when invited as user" do
        create_account(base_attrs.merge(email: "admin@test.com", role_name: "admin"))
        updated = subject.invite(build_record(base_attrs.merge(email: "admin@test.com", role_name: "user")))
        expect(updated.role_name).to eq("admin")
      end

      it "keeps an admin unchanged when invited as org_owner" do
        create_account(base_attrs.merge(email: "admin@test.com", role_name: "admin"))
        updated = subject.invite(
          build_record(base_attrs.merge(email: "admin@test.com", role_name: "org_owner", role_scope: { org: ["1"] }))
        )
        expect(updated.role_name).to eq("admin")
      end

      it "keeps an org_owner unchanged when invited as user" do
        create_account(base_attrs.merge(email: "owner@test.com", role_name: "org_owner", role_scope: { org: ["2"] }))
        updated = subject.invite(build_record(base_attrs.merge(email: "owner@test.com", role_name: "user")))
        expect(updated.role_name).to eq("org_owner")
        expect(updated.role_scope).to eq("org" => ["2"])
      end
    end

    context "as org_owner" do
      subject { described_class.new(build_context("org_owner", scopes: { org: ["1"] }, id: 2)) }

      it "creates a new account scoped to the actor's org" do
        created = subject.invite(build_record(base_attrs.merge(role_name: "org_owner", role_scope: { org: ["1"] })))
        expect(created.role_name).to eq("org_owner")
        expect(created.role_scope).to eq("org" => ["1"])
      end

      it "rejects an org outside the actor's reach" do
        expect {
          subject.invite(build_record(base_attrs.merge(role_name: "org_owner", role_scope: { org: ["999"] })))
        }.to raise_error(Verse::Error::Unauthorized)
      end

      it "cannot invite an admin" do
        expect {
          subject.invite(build_record(base_attrs.merge(role_name: "admin")))
        }.to raise_error(Verse::Error::Unauthorized)
      end

      context "invite on an existing email" do
        before do
          create_account(base_attrs.merge(email: "existing@test.com", role_name: "user"))

          # The existing accounts are not members of the actor's org projects, so
          # they are outside the org_owner's read scope and the invite returns
          # only id/name/email. Stub the read-scope lookup to return no members.
          stub_org_owner_read_scope
        end

        it "promotes a user to org_owner of the actor's org" do
          updated = subject.invite(
            build_record(
              base_attrs.merge(
                email: "existing@test.com",
                role_name: "org_owner",
                role_scope: { org: ["1"] }
              )
            )
          )
          expect(updated.email).to eq("existing@test.com")
          expect(updated.role_name).to be_nil

          stored = system_repo.find_by({ email: "existing@test.com" })
          expect(stored.role_name).to eq("org_owner")
          expect(stored.role_scope).to eq("org" => ["1"])
        end

        it "leaves an org_owner of another org unchanged when invited as user" do
          create_account(base_attrs.merge(email: "owner@test.com", role_name: "org_owner", role_scope: { org: ["2"] }))
          updated = subject.invite(build_record(base_attrs.merge(email: "owner@test.com", role_name: "user")))
          expect(updated.email).to eq("owner@test.com")
          expect(updated.role_name).to be_nil

          stored = system_repo.find_by({ email: "owner@test.com" })
          expect(stored.role_name).to eq("org_owner")
          expect(stored.role_scope).to eq("org" => ["2"])
        end

        it "expands an org_owner's scope when invited as org_owner" do
          create_account(base_attrs.merge(email: "owner@test.com", role_name: "org_owner", role_scope: { org: ["2"] }))
          updated = subject.invite(
            build_record(base_attrs.merge(email: "owner@test.com", role_name: "org_owner", role_scope: { org: ["1"] }))
          )
          expect(updated.email).to eq("owner@test.com")
          expect(updated.role_scope).to be_nil

          stored = system_repo.find_by({ email: "owner@test.com" })
          expect(stored.role_scope).to eq("org" => %w[1 2])
        end

        it "grants only the requested org, not all of the actor's orgs" do
          # Actor owns orgs 1 and 2 but requests only org 1.
          actor = described_class.new(build_context("org_owner", scopes: { org: ["1", "2"] }, id: 2))
          create_account(base_attrs.merge(email: "owner@test.com", role_name: "org_owner", role_scope: { org: ["3"] }))
          actor.invite(
            build_record(base_attrs.merge(email: "owner@test.com", role_name: "org_owner", role_scope: { org: ["1"] }))
          )

          stored = system_repo.find_by({ email: "owner@test.com" })
          expect(stored.role_scope).to eq("org" => %w[1 3])
        end

        it "raises when a requested org falls outside the actor's reach" do
          create_account(base_attrs.merge(email: "owner@test.com", role_name: "org_owner", role_scope: { org: ["2"] }))
          expect {
            subject.invite(
              build_record(
                base_attrs.merge(
                  email: "owner@test.com",
                  role_name: "org_owner",
                  role_scope: { org: ["1",
                                      "999"] }
                )
              )
            )
          }.to raise_error(Verse::Error::Unauthorized, /outside your own organizations/)
        end

        it "allows existing orgs outside the actor's reach when inviting as org_owner" do
          # Owner of A invites an existing owner of B as owner of A with org [B, A]
          # → succeeds with scope [A, B] (B is already in the current scope).
          create_account(base_attrs.merge(email: "owner@test.com", role_name: "org_owner", role_scope: { org: ["2"] }))
          subject.invite(
            build_record(
              base_attrs.merge(
                email: "owner@test.com",
                role_name: "org_owner",
                role_scope: { org: ["2", "1"] }
              )
            )
          )

          stored = system_repo.find_by({ email: "owner@test.com" })
          expect(stored.role_scope).to eq("org" => %w[1 2])
        end

        it "rejects inviting a disabled account with a generic message (unreadable)" do
          create_account(base_attrs.merge(email: "disabled@test.com", enabled: false))
          expect {
            subject.invite(build_record(base_attrs.merge(email: "disabled@test.com")))
          }.to raise_error(Verse::Error::Unauthorized, /contact an administrator/)
        end

        it "treats an account ranked above the actor as a no-op (unreadable, restricted response)" do
          create_account(base_attrs.merge(email: "admin@test.com", role_name: "admin"))
          updated = subject.invite(build_record(base_attrs.merge(email: "admin@test.com")))

          # The account is outside the org_owner's read scope, so the response is
          # restricted to id/name/email and reveals no role.
          expect(updated.email).to eq("admin@test.com")
          expect(updated.role_name).to be_nil

          # No write happened: the account is unchanged.
          stored = system_repo.find_by({ email: "admin@test.com" })
          expect(stored.role_name).to eq("admin")
        end
      end
    end

    context "as user" do
      subject { described_class.new(build_context("user", id: 10)) }

      it "cannot invite" do
        expect {
          subject.invite(build_record(base_attrs))
        }.to raise_error(Verse::Error::Unauthorized)
      end
    end
  end

  describe "#update" do
    context "as admin" do
      subject { described_class.new(build_context("admin")) }

      it "updates a name" do
        id = create_account(base_attrs)
        updated = subject.update(build_record({ id: id, name: "New Name" }))
        expect(updated.name).to eq("New Name")
      end

      it "can assign org_owner with any scope" do
        id = create_account(base_attrs)
        updated = subject.update(build_record({ id: id, role_name: "org_owner", role_scope: { org: ["999"] } }))
        expect(updated.role_name).to eq("org_owner")
        expect(updated.role_scope).to eq("org" => ["999"])
      end

      it "can assign admin" do
        id = create_account(base_attrs)
        updated = subject.update(build_record({ id: id, role_name: "admin" }))
        expect(updated.role_name).to eq("admin")
      end

      it "auto-demotes an org_owner whose org list becomes empty" do
        id = create_account(base_attrs.merge(role_name: "org_owner", role_scope: { org: ["1"] }))
        updated = subject.update(build_record({ id: id, role_scope: { org: [] } }))
        expect(updated.role_name).to eq("user")
      end

      it "cannot assign system" do
        id = create_account(base_attrs)
        expect {
          subject.update(build_record({ id: id, role_name: "system" }))
        }.to raise_error(Verse::Error::Unauthorized)
      end
    end

    context "as org_owner" do
      # Realistic org_owner rights so accounts.scoped(:update) resolves the
      # org-scoped membership query (the *.*.* default would return all accounts).
      subject {
        described_class.new(
          build_context(
            "org_owner",
            scopes: { org: ["1"] },
            id: 2,
            rights: ["iam:accounts.update.as_org_owner", "iam:accounts.read.as_org_owner"]
          )
        )
      }

      before do
        # Default: no co-members in the update scope.
        @lookup = double(ProjectMembership::Lookup)
        allow(ProjectMembership::Lookup).to receive(:new).and_return(@lookup)
        allow(@lookup).to receive(:member_account_ids).with(organization_ids: ["1"]).and_return([])
        allow(@lookup).to receive(:memberships_for).with(2).and_return([])
      end

      # The org_owner update scope resolves co-members via the dataset service.
      # Stub it to include the target account so it is within the update scope.
      def put_target_in_scope(account_id)
        allow(@lookup).to receive(:member_account_ids).with(organization_ids: ["1"]).and_return([account_id])
      end

      it "can assign a lower role within its orgs" do
        id = create_account(base_attrs)
        put_target_in_scope(id)
        updated = subject.update(build_record({ id: id, role_name: "org_owner", role_scope: { org: ["1"] } }))
        expect(updated.role_name).to eq("org_owner")
      end

      it "cannot assign admin" do
        id = create_account(base_attrs)
        put_target_in_scope(id)
        expect {
          subject.update(build_record({ id: id, role_name: "admin" }))
        }.to raise_error(Verse::Error::Unauthorized)
      end

      it "cannot add an org outside its reach" do
        id = create_account(base_attrs)
        put_target_in_scope(id)
        expect {
          subject.update(build_record({ id: id, role_scope: { org: ["999"] } }))
        }.to raise_error(Verse::Error::Unauthorized)
      end

      it "preserves orgs outside its reach" do
        id = create_account(base_attrs.merge(role_name: "org_owner", role_scope: { org: ["1", "999"] }))
        put_target_in_scope(id)
        updated = subject.update(build_record({ id: id, role_scope: { org: ["1"] } }))
        expect(updated.role_scope).to eq("org" => %w[1 999])
      end

      it "cannot toggle enabled on an account outside its update scope" do
        id = create_account(base_attrs.merge(role_scope: { org: ["999"] }))
        # No put_target_in_scope: the target is not in the org_owner's read/update scope.
        expect {
          subject.update(build_record({ id: id, enabled: false }))
        }.to raise_error(Verse::Error::RecordNotFound)
      end

      it "can toggle enabled on a lower-ranked account in scope" do
        id = create_account(base_attrs.merge(role_scope: { org: ["1"] }))
        put_target_in_scope(id)
        updated = subject.update(build_record({ id: id, enabled: false }))
        expect(updated.enabled).to eq(false)
      end

      it "can disable a plain user member of its org's projects" do
        id = create_account(base_attrs)
        put_target_in_scope(id)
        updated = subject.update(build_record({ id: id, enabled: false }))
        expect(updated.enabled).to eq(false)
      end

      it "cannot demote an admin" do
        id = create_account(base_attrs.merge(role_name: "admin"))
        put_target_in_scope(id)
        expect {
          subject.update(build_record({ id: id, role_name: "user" }))
        }.to raise_error(Verse::Error::Unauthorized)
      end

      it "cannot disable an admin" do
        id = create_account(base_attrs.merge(role_name: "admin"))
        put_target_in_scope(id)
        expect {
          subject.update(build_record({ id: id, enabled: false }))
        }.to raise_error(Verse::Error::Unauthorized)
      end

      it "cannot demote a peer org_owner" do
        id = create_account(base_attrs.merge(role_name: "org_owner", role_scope: { org: ["1"] }))
        put_target_in_scope(id)
        expect {
          subject.update(build_record({ id: id, role_name: "user" }))
        }.to raise_error(Verse::Error::Unauthorized)
      end

      it "cannot disable a peer org_owner" do
        id = create_account(base_attrs.merge(role_name: "org_owner", role_scope: { org: ["1"] }))
        put_target_in_scope(id)
        expect {
          subject.update(build_record({ id: id, enabled: false }))
        }.to raise_error(Verse::Error::Unauthorized)
      end

      # Org-owner removal: the frontend sends only role_scope (the org removed);
      # role_name is left unchanged (a no-op) and the server auto-demotes when the
      # org list becomes empty.
      it "removes its org from a co-owner with [A] → demotes to user" do
        id = create_account(base_attrs.merge(role_name: "org_owner", role_scope: { org: ["1"] }))
        put_target_in_scope(id)
        updated = subject.update(build_record({ id: id, role_name: "org_owner", role_scope: { org: [] } }))
        expect(updated.role_name).to eq("user")
        expect(updated.role_scope).to eq("org" => [])
      end

      it "removes its org from a co-owner with [A, B] → stays org_owner with [B]" do
        id = create_account(base_attrs.merge(role_name: "org_owner", role_scope: { org: ["1", "2"] }))
        put_target_in_scope(id)
        updated = subject.update(build_record({ id: id, role_name: "org_owner", role_scope: { org: ["2"] } }))
        expect(updated.role_name).to eq("org_owner")
        expect(updated.role_scope).to eq("org" => ["2"])
      end
    end

    context "self-update" do
      let(:self_id) { create_account(base_attrs.merge(email: "self@test.com")) }
      let(:self_context) { build_context("user", id: self_id, email: "self@test.com") }
      subject { described_class.new(self_context) }

      before do
        # The user read scope resolves co-members via ProjectMembership::Lookup.
        @lookup = double(ProjectMembership::Lookup)
        allow(ProjectMembership::Lookup).to receive(:new).and_return(@lookup)
        allow(@lookup).to receive(:memberships_for).with(self_id).and_return([])
        allow(@lookup).to receive(:member_account_ids).with(project_ids: []).and_return([])
      end

      it "allows updating only the name" do
        updated = subject.update(build_record({ id: self_id, name: "New Self" }))
        expect(updated.name).to eq("New Self")
        expect(subject.auth_context.checked?).to be(true)
      end

      it "rejects role_name change on self" do
        expect {
          subject.update(build_record({ id: self_id, role_name: "admin" }))
        }.to raise_error(Verse::Error::Unauthorized)
      end

      it "rejects role_scope change on self" do
        expect {
          subject.update(build_record({ id: self_id, role_scope: { org: ["1"] } }))
        }.to raise_error(Verse::Error::Unauthorized)
      end

      it "rejects enabled change on self" do
        expect {
          subject.update(build_record({ id: self_id, enabled: false }))
        }.to raise_error(Verse::Error::Unauthorized)
      end
    end

    context "as a regular user updating another account" do
      let(:target_id) { create_account(base_attrs) }
      let(:user_context) do
        build_context(
          "user",
          id: 10,
          email: "user@test.com",
          rights: ["iam:accounts.update.own", "iam:accounts.read.as_user"]
        )
      end
      subject { described_class.new(user_context) }

      before do
        # The as_user read scope resolves co-members via the dataset service.
        @lookup = double(ProjectMembership::Lookup)
        allow(ProjectMembership::Lookup).to receive(:new).and_return(@lookup)
        allow(@lookup).to receive(:memberships_for).with(10).and_return([])
        allow(@lookup).to receive(:member_account_ids).with(project_ids: []).and_return([])
      end

      it "cannot update another account (not in read scope)" do
        expect {
          subject.update(build_record({ id: target_id, name: "Hacked" }))
        }.to raise_error(Verse::Error::RecordNotFound)
      end

      it "returns 403 (Unauthorized), not 500, when changing a co-member's role_name" do
        # The user can read the co-member through the as_user read scope, but the
        # `own` update right does not cover them. Changing role_name must reject
        # with Unauthorized, never reach RoleHierarchy.rank("self") (which would
        # raise ArgumentError → 500).
        allow(@lookup).to receive(:memberships_for).with(10).and_return(
          [double(project_id: "p1", role: "annotator", organization_id: 1)]
        )
        allow(@lookup).to receive(:member_account_ids).with(project_ids: ["p1"]).and_return([target_id])

        expect {
          subject.update(build_record({ id: target_id, role_name: "reviewer" }))
        }.to raise_error(Verse::Error::Unauthorized)
      end
    end
  end

  describe "#resend_pending_invitations (system-only low-level)" do
    context "as system" do
      subject { described_class.new(build_context("system")) }

      it "resends a pending invitation" do
        id = create_account(base_attrs.merge(invitation_token: "tok", invitation_expired_at: Time.now - 1))
        subject.resend_pending_invitations(id)
        updated = system_repo.find!(id)
        expect(updated.invitation_expired_at).to eq(Time.now + 3 * 24 * 60 * 60)
      end

      it "rejects resending for an account that already joined" do
        id = create_account(base_attrs.merge(joined_at: Time.now - 1000))
        expect {
          subject.resend_pending_invitations(id)
        }.to raise_error(Verse::Error::NotFound)
      end

      it "rejects resending for a disabled account" do
        id = create_account(base_attrs.merge(enabled: false))
        expect {
          subject.resend_pending_invitations(id)
        }.to raise_error(Verse::Error::Unauthorized)
      end
    end

    context "as admin" do
      subject { described_class.new(build_context("admin")) }

      it "allows direct low-level resend (admin has full rights, like system)" do
        id = create_account(base_attrs.merge(invitation_token: "tok"))
        expect { subject.resend_pending_invitations(id) }.not_to raise_error
      end
    end
  end

  describe "#resend_invitation (guarded)" do
    let(:pending_id) { create_account(base_attrs.merge(email: "pending@test.com", invitation_token: "tok")) }

    context "as admin" do
      subject { described_class.new(build_context("admin")) }

      it "resends a pending invitation" do
        expect {
          subject.resend_invitation(pending_id)
        }.not_to raise_error
        expect(subject.auth_context.checked?).to be(true)
      end

      it "emits iam:accounts:updated carrying the resending admin's id" do
        captured = []
        allow(Verse).to receive(:publish_resource_event) do |**opts|
          captured << [opts[:event], opts[:payload][:metadata]]
        end

        subject.resend_invitation(pending_id)

        updated = captured.find { |event, _| event == "updated" }
        expect(updated).not_to be_nil
        expect(updated[1]).to include(actor_account_id: 1, actor_account_email: "actor@test.com")
      end
    end

    context "as org_owner" do
      subject { described_class.new(build_context("org_owner", scopes: { org: ["1"] }, id: 2)) }

      before do
        # The org_owner read scope resolves co-members via ProjectMembership::Lookup.
        @lookup = double(ProjectMembership::Lookup)
        allow(ProjectMembership::Lookup).to receive(:new).and_return(@lookup)
        allow(@lookup).to receive(:member_account_ids).with(organization_ids: ["1"]).and_return([pending_id])
        allow(@lookup).to receive(:memberships_for).with(2).and_return([])
      end

      it "resends for a user account" do
        expect {
          subject.resend_invitation(pending_id)
        }.not_to raise_error
      end

      it "rejects resending for an admin account" do
        admin_id = create_account(base_attrs.merge(email: "admin@test.com", role_name: "admin"))
        expect {
          subject.resend_invitation(admin_id)
        }.to raise_error(Verse::Error::Unauthorized)
      end

      it "rejects resending for an org_owner with an org outside the actor's reach" do
        owner_id = create_account(
          base_attrs.merge(
            email: "owner@test.com",
            role_name: "org_owner",
            role_scope: { org: ["999"] }
          )
        )
        expect {
          subject.resend_invitation(owner_id)
        }.to raise_error(Verse::Error::Unauthorized)
      end
    end

    context "as user" do
      subject { described_class.new(build_context("user", id: 10)) }

      it "rejects resending" do
        expect {
          subject.resend_invitation(pending_id)
        }.to raise_error(Verse::Error::Unauthorized)
      end
    end
  end

  describe "#delete" do
    subject { described_class.new(build_context("admin", id: 1, email: "admin@test.com")) }

    it "emits iam:accounts:deleted with the deleting admin's id" do
      id = create_account(base_attrs.merge(email: "pending@test.com"))
      captured = []
      allow(Verse).to receive(:publish_resource_event) do |**opts|
        captured << [opts[:event], opts[:payload][:metadata]]
      end

      subject.delete(id)

      deleted = captured.find { |event, _| event == "deleted" }
      expect(deleted).not_to be_nil
      expect(deleted[1]).to include(
        actor_account_id: 1,
        actor_account_email: "admin@test.com"
      )
    end
  end

  describe "#remove_org_from_account_role_scope" do
    subject { described_class.new(build_context("system")) }

    it "removes the org from org_owner scopes and demotes empty org_owners" do
      owner1 = create_account(
        base_attrs.merge(
          email: "o1@test.com",
          role_name: "org_owner",
          role_scope: { org: ["999"] }
        )
      )
      owner2 = create_account(
        base_attrs.merge(
          email: "o2@test.com",
          role_name: "org_owner",
          role_scope: { org: [
            "999", "111"
          ] }
        )
      )

      subject.remove_org_from_account_role_scope("999")

      expect(system_repo.find!(owner1).role_name).to eq("user")
      expect(system_repo.find!(owner2).role_scope).to eq("org" => ["111"])
    end

    it "emits iam:accounts:updated events carrying the triggering event's actor" do
      create_account(base_attrs.merge(email: "o1@test.com", role_name: "org_owner", role_scope: { org: ["999"] }))
      captured = []
      allow(Verse).to receive(:publish_resource_event) do |**opts|
        captured << [opts[:event], opts[:payload][:metadata]]
      end

      actor_metadata = {
        actor_account_id: 5,
        actor_account_email: "admin@example.com",
        actor_account_role_name: "admin"
      }
      subject.remove_org_from_account_role_scope("999", actor_metadata)

      updated = captured.filter_map { |event, metadata| metadata if event == "updated" }
      expect(updated).not_to be_empty
      updated.each do |metadata|
        expect(metadata).to include(
          actor_account_id: 5,
          actor_account_email: "admin@example.com",
          actor_account_role_name: "admin"
        )
      end
    end
  end

  describe "account disclosure on invite" do
    context "as org_owner inviting an existing account outside its read scope", as: :org_owner do
      subject { described_class.new(build_context("org_owner", scopes: { org: ["1"] }, id: 2)) }

      before do
        stub_org_owner_read_scope
      end

      it "returns only id/name/email for an account in another org" do
        other = create_account(
          base_attrs.merge(email: "other@test.com", role_name: "org_owner", role_scope: { org: ["9"] })
        )

        result = subject.invite(build_record(base_attrs.merge(email: "other@test.com", role_name: "user")))

        expect(result.id.to_s).to eq(other.to_s)
        expect(result.email).to eq("other@test.com")
        expect(result.role_name).to be_nil
        expect(result.role_scope).to be_nil
        expect(result.enabled).to be_nil
      end
    end

    context "as admin" do
      subject { described_class.new(build_context("admin")) }

      it "returns the full record for an existing account" do
        create_account(base_attrs.merge(email: "existing@test.com", role_name: "org_owner", role_scope: { org: ["9"] }))

        result = subject.invite(build_record(base_attrs.merge(email: "existing@test.com", role_name: "user")))

        expect(result.email).to eq("existing@test.com")
        expect(result.role_name).to eq("org_owner")
        expect(result.role_scope).to eq("org" => ["9"])
      end
    end
  end

  describe "API-key account invites" do
    def api_key_context(scope, orgs: ["1"])
      Verse::Auth::Context.from_role(
        "api:#{scope}",
        custom_scopes: { org: orgs },
        metadata: { id: 99, email: "key@test.com", name: "Key", role: "api:#{scope}" }
      )
    end

    context "as api:account_rw_all" do
      subject { described_class.new(api_key_context("account_rw_all")) }

      it "can invite an account with role admin (all? branch)" do
        created = subject.invite(
          build_record(base_attrs.merge(email: "admin@test.com", role_name: "admin"))
        )

        expect(created.email).to eq("admin@test.com")
        expect(created.role_name).to eq("admin")
        expect(subject.auth_context.checked?).to be(true)
      end
    end

    context "as api:org_rw_org" do
      subject { described_class.new(api_key_context("org_rw_org")) }

      it "can invite into its own org (as_org_owner branch)" do
        created = subject.invite(
          build_record(base_attrs.merge(email: "member@test.com", role_name: "user"))
        )

        expect(created.email).to eq("member@test.com")
        expect(created.role_name).to eq("user")
      end

      it "is rejected for another org" do
        expect {
          subject.invite(
            build_record(
              base_attrs.merge(
                email: "member@test.com",
                role_name: "org_owner",
                role_scope: { org: ["999"] }
              )
            )
          )
        }.to raise_error(Verse::Error::Unauthorized, /outside your own organizations/)
      end

      it "cannot assign admin (as_org_owner branch)" do
        expect {
          subject.invite(
            build_record(base_attrs.merge(email: "member@test.com", role_name: "admin"))
          )
        }.to raise_error(Verse::Error::Unauthorized, /do not have permission to invite an account with role/)
      end
    end

    context "as api:project_rw_org" do
      subject { described_class.new(api_key_context("project_rw_org")) }

      it "cannot invite through IAM (no iam:accounts.invite right)" do
        expect {
          subject.invite(build_record(base_attrs))
        }.to raise_error(Verse::Error::Unauthorized, /do not have permission to invite an account/)
      end
    end
  end
end
