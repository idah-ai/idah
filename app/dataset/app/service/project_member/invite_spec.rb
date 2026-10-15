# frozen_string_literal: true

require "spec_helper"

RSpec.describe ProjectMember::Service, database: true do
  let(:system_context) { Verse::Auth::Context[:system] }
  let(:project_repo) { Project::Repository.new(system_context) }
  let(:member_repo) { ProjectMember::Repository.new(system_context) }

  let(:org_a) { 1 }
  let(:org_b) { 2 }

  let(:project_a) { project_repo.create(name: "Project A", created_by_email: "system@example.com", organization_id: org_a) }
  let(:project_b) { project_repo.create(name: "Project B", created_by_email: "system@example.com", organization_id: org_b) }

  def build_context(role, scopes: {}, id: 99, email: "actor@test.com", name: "Actor")
    # Build from the role so rights come from common/data/roles/*.yml via the
    # real RoleBackend (set on boot), not a hardcoded list.
    Verse::Auth::Context.from_role(
      role,
      custom_scopes: scopes,
      metadata: { id:, email:, name:, role: role.to_sym }
    )
  end

  def account_stub(id:, email:, name: "Member", enabled: true, joined_at: nil)
    double(id: id, email: email, name: name, enabled: enabled, joined_at: joined_at)
  end

  before do
    allow(Time).to receive(:now).and_return(Time.utc(2025, 1, 1, 0, 0, 0))
  end

  describe "#invite" do
    context "as an org_owner of the project's org" do
      subject { described_class.new(build_context("org_owner", scopes: { org: [org_a.to_s] }, id: 2)) }

      before do
        # No existing account for the invited email.
        allow(Api[:idah].iam.accounts).to receive(:index).and_return(double(data: []))
        allow(Api[:idah].iam.accounts).to receive(:invite).and_return(
          account_stub(id: 100, email: "new@test.com")
        )
      end

      it "invites a new member and creates the membership server-side" do
        member = subject.invite(project_a, members: [{ email: "new@test.com", role: "annotator" }]).first

        expect(member.project_id).to eq(project_a)
        expect(member.email).to eq("new@test.com")
        expect(member.role).to eq("annotator")
        expect(member.account_id).to eq(100)
        expect(member.invited_by_id).to eq(2)
        expect(subject.auth_context.checked?).to be(true)
      end

      it "calls the IAM invite with role_name user and empty scope" do
        expect(Api[:idah].iam.accounts).to receive(:invite).with(
          attributes: { email: "new@test.com", role_name: "user", role_scope: {} }
        ).and_return(account_stub(id: 100, email: "new@test.com"))

        subject.invite(project_a, members: [{ email: "new@test.com", role: "annotator" }])
      end

      it "emits dataset:project_members:created carrying the inviter's id" do
        captured = []
        allow(Verse).to receive(:publish_resource_event) do |**opts|
          captured << [opts[:resource_type], opts[:event], opts[:payload][:metadata]]
        end

        subject.invite(project_a, members: [{ email: "new@test.com", role: "annotator" }])

        created = captured.find do |resource_type, event, _|
          resource_type == Resource::Dataset::ProjectMembers && event == "created"
        end
        expect(created).not_to be_nil
        expect(created[2]).to include(actor_account_id: 2, actor_account_email: "actor@test.com")
      end

      it "runs the membership write on a plain system context (no actor identity in the write context)" do
        # The system repository used for the write (`system_project_members`) must
        # NOT carry the inviter's identity in its auth context — only the event
        # metadata does. Assert on that repository directly rather than stubbing
        # `ProjectMember::Repository.new` (which is also called by
        # ProjectAccess::Service during effective-rank resolution).
        subject.invite(project_a, members: [{ email: "new@test.com", role: "annotator" }])

        expect(subject.system_project_members.auth_context.metadata[:id]).to be_nil
      end

      it "can assign project_owner (effective rank org_owner)" do
        member = subject.invite(project_a, members: [{ email: "new@test.com", role: "project_owner" }]).first
        expect(member.role).to eq("project_owner")
      end

      it "is all-or-nothing: rejects the whole batch when one member is invalid" do
        expect {
          subject.invite(project_a, members: [
            { email: "new@test.com", role: "annotator" },
            { email: "bad@test.com", role: "superuser" }
          ])
        }.to raise_error(Verse::Error::ValidationFailed)

        expect(member_repo.index({}).count).to eq(0)
      end

      it "rejects a disabled account with an explicit error" do
        allow(Api[:idah].iam.accounts).to receive(:index).and_return(
          double(data: [account_stub(id: 100, email: "disabled@test.com", enabled: false)])
        )

        expect {
          subject.invite(project_a, members: [{ email: "disabled@test.com", role: "annotator" }])
        }.to raise_error(Verse::Error::ValidationFailed, /re-enable/)
      end

      it "rejects an already-active member instead of silently changing its role" do
        member_repo.create(
          project_id: project_a, account_id: 100, role: "annotator",
          name: "Old", email: "new@test.com", invited_by_id: 1
        )
        allow(Api[:idah].iam.accounts).to receive(:index).and_return(
          double(data: [account_stub(id: 100, email: "new@test.com")])
        )

        expect {
          subject.invite(project_a, members: [{ email: "new@test.com", role: "reviewer" }])
        }.to raise_error(Verse::Error::ValidationFailed, /already an active member/)

        # Nothing was written.
        expect(member_repo.find!(member_repo.index({}).first.id).role).to eq("annotator")
      end
    end

    context "re-invite of a removed member" do
      subject { described_class.new(build_context("org_owner", scopes: { org: [org_a.to_s] }, id: 2)) }

      before do
        allow(Api[:idah].iam.accounts).to receive(:index).and_return(
          double(data: [account_stub(id: 100, email: "removed@test.com")])
        )
        allow(Api[:idah].iam.accounts).to receive(:invite).and_return(
          account_stub(id: 100, email: "removed@test.com")
        )
      end

      it "re-enables the existing disabled row instead of creating a new one, with no email" do
        removed_id = member_repo.create(
          project_id: project_a, account_id: 100, role: "annotator",
          name: "Old", email: "removed@test.com", invited_by_id: 1, disabled_at: Time.now
        )
        expect(Service::Notification).not_to receive(:email)

        member = subject.invite(project_a, members: [{ email: "removed@test.com", role: "reviewer" }]).first

        expect(member.id.to_s).to eq(removed_id)
        expect(member.disabled_at).to be_nil
        expect(member.role).to eq("reviewer")
        expect(member_repo.index({}).count).to eq(1)
      end

      it "allows an org_owner to re-add a removed project_owner as reviewer" do
        member_repo.create(
          project_id: project_a, account_id: 100, role: "project_owner",
          name: "Old", email: "removed@test.com", invited_by_id: 1, disabled_at: Time.now
        )

        member = subject.invite(project_a, members: [{ email: "removed@test.com", role: "reviewer" }]).first
        expect(member.role).to eq("reviewer")
      end
    end

    context "re-invite by a project_owner" do
      subject { described_class.new(build_context("user", id: 3)) }

      before do
        # The actor is a project_owner on the project.
        member_repo.create(
          project_id: project_a, account_id: 3, role: "project_owner",
          name: "Owner", email: "owner@test.com", invited_by_id: 1
        )
        allow(Api[:idah].iam.accounts).to receive(:index).and_return(
          double(data: [account_stub(id: 100, email: "removed@test.com")])
        )
        allow(Api[:idah].iam.accounts).to receive(:invite).and_return(
          account_stub(id: 100, email: "removed@test.com")
        )
      end

      it "rejects re-adding a removed project_owner as project_owner" do
        member_repo.create(
          project_id: project_a, account_id: 100, role: "project_owner",
          name: "Old", email: "removed@test.com", invited_by_id: 1, disabled_at: Time.now
        )

        # A project_owner cannot assign project_owner; rejected during validation.
        expect {
          subject.invite(project_a, members: [{ email: "removed@test.com", role: "project_owner" }])
        }.to raise_error(Verse::Error::ValidationFailed, /cannot assign role/)
      end

      it "allows re-adding a removed project_owner as reviewer" do
        member_repo.create(
          project_id: project_a, account_id: 100, role: "project_owner",
          name: "Old", email: "removed@test.com", invited_by_id: 1, disabled_at: Time.now
        )

        member = subject.invite(project_a, members: [{ email: "removed@test.com", role: "reviewer" }]).first
        expect(member.role).to eq("reviewer")
      end

      it "a rejected re-invite in a batch writes nothing and calls no IAM invite" do
        member_repo.create(
          project_id: project_a, account_id: 100, role: "project_owner",
          name: "Old", email: "removed@test.com", invited_by_id: 1, disabled_at: Time.now
        )
        # The project_owner cannot re-add the removed project_owner as project_owner.
        # The batch also contains a brand-new email that would otherwise be invited.
        # Stub per email so new@test.com resolves to no existing account — proving
        # the batch is blocked before any IAM invite is called.
        allow(Api[:idah].iam.accounts).to receive(:index) do |params|
          email = params.dig(:filter, :email)
          if email == "removed@test.com"
            double(data: [account_stub(id: 100, email: "removed@test.com")])
          else
            double(data: [])
          end
        end
        expect(Api[:idah].iam.accounts).not_to receive(:invite)

        expect {
          subject.invite(project_a, members: [
            { email: "new@test.com", role: "annotator" },
            { email: "removed@test.com", role: "project_owner" }
          ])
        }.to raise_error(Verse::Error::ValidationFailed)

        # Nothing was written: no new member row, and the removed member's row
        # stays disabled.
        expect(member_repo.index({ email: "new@test.com" }).count).to eq(0)
        removed = member_repo.index({ account_id: 100 }).first
        expect(removed.disabled_at).not_to be_nil
        expect(removed.role).to eq("project_owner")
      end
    end

    context "as an org_owner acting through a project_owner membership on a foreign project" do
      subject { described_class.new(build_context("org_owner", scopes: { org: [org_a.to_s] }, id: 2)) }

      before do
        member_repo.create(
          project_id: project_b, account_id: 2, role: "project_owner",
          name: "Owner", email: "owner@test.com", invited_by_id: 1
        )
        allow(Api[:idah].iam.accounts).to receive(:index).and_return(double(data: []))
        allow(Api[:idah].iam.accounts).to receive(:invite).and_return(
          account_stub(id: 100, email: "new@test.com")
        )
      end

      it "can invite a member on the foreign project (effective rank project_owner)" do
        member = subject.invite(project_b, members: [{ email: "new@test.com", role: "annotator" }]).first
        expect(member.project_id).to eq(project_b)
      end

      it "cannot assign project_owner on the foreign project" do
        expect {
          subject.invite(project_b, members: [{ email: "new@test.com", role: "project_owner" }])
        }.to raise_error(Verse::Error::ValidationFailed)
      end
    end

    context "as a reviewer" do
      subject { described_class.new(build_context("user", id: 3)) }

      before do
        member_repo.create(
          project_id: project_a, account_id: 3, role: "reviewer",
          name: "Reviewer", email: "reviewer@test.com", invited_by_id: 1
        )
      end

      it "cannot invite" do
        expect {
          subject.invite(project_a, members: [{ email: "new@test.com", role: "annotator" }])
        }.to raise_error(Verse::Error::Unauthorized)
      end
    end
  end

  describe "#resend_invitation" do
    let(:member_id) do
      member_repo.create(
        project_id: project_a, account_id: 100, role: "annotator",
        name: "Member", email: "member@test.com", invited_by_id: 1
      )
    end

    context "as an org_owner of the project's org" do
      subject { described_class.new(build_context("org_owner", scopes: { org: [org_a.to_s] }, id: 2)) }

      before do
        allow(Api[:idah].iam.accounts).to receive(:show).and_return(
          account_stub(id: 100, email: "member@test.com", joined_at: nil)
        )
        allow(Api[:idah].iam.accounts).to receive(:resend_invitation).and_return(true)
      end

      it "resends for a member whose account has not joined" do
        expect(Api[:idah].iam.accounts).to receive(:resend_invitation).with(id: 100)
        subject.resend_invitation(member_id)
        expect(subject.auth_context.checked?).to be(true)
      end

      it "rejects resending for an account that already joined" do
        allow(Api[:idah].iam.accounts).to receive(:show).and_return(
          account_stub(id: 100, email: "member@test.com", joined_at: Time.now)
        )

        expect {
          subject.resend_invitation(member_id)
        }.to raise_error(Verse::Error::Unauthorized, /already joined/)
      end

      it "rejects resending for a disabled account" do
        allow(Api[:idah].iam.accounts).to receive(:show).and_return(
          account_stub(id: 100, email: "member@test.com", joined_at: nil, enabled: false)
        )

        expect {
          subject.resend_invitation(member_id)
        }.to raise_error(Verse::Error::Unauthorized, /re-enable/)
      end
    end

    context "as a reviewer" do
      subject { described_class.new(build_context("user", id: 3)) }

      before do
        member_repo.create(
          project_id: project_a, account_id: 3, role: "reviewer",
          name: "Reviewer", email: "reviewer@test.com", invited_by_id: 1
        )
      end

      it "cannot resend" do
        expect {
          subject.resend_invitation(member_id)
        }.to raise_error(Verse::Error::Unauthorized)
      end
    end
  end

  describe "#delete_account_members (event-driven cascade)" do
    let(:actor_metadata) do
      { actor_account_id: 7, actor_account_email: "admin@example.com", actor_account_role_name: "admin" }
    end

    it "emits dataset:project_members:deleted events carrying the triggering event's actor" do
      member_repo.create(
        project_id: project_a, account_id: 100, role: "annotator",
        name: "Member", email: "member@test.com", invited_by_id: 1
      )
      captured = []
      allow(Verse).to receive(:publish_resource_event) do |**opts|
        captured << [opts[:event], opts[:payload][:metadata]]
      end

      subject = described_class.new(build_context("system"))
      subject.delete_account_members(100, actor_metadata)

      deleted = captured.select { |event, _| event == "deleted" }
      expect(deleted).not_to be_empty
      deleted.each do |_, metadata|
        expect(metadata).to include(
          actor_account_id: 7,
          actor_account_email: "admin@example.com",
          actor_account_role_name: "admin"
        )
      end
    end
  end
end