# frozen_string_literal: true

require "spec_helper"

# Non-mocked request specs for the guarded project-member invite/resend endpoints.
# They exercise the real exposition → service wiring (no `instance_double`), with
# only the cross-service IAM HTTP calls stubbed.
RSpec.describe ProjectMembersExpo, type: :exposition, database: true, as: :org_owner do
  let(:system_context) { Verse::Auth::Context[:system] }
  let(:project_repo) { Project::Repository.new(system_context) }
  let(:member_repo) { ProjectMember::Repository.new(system_context) }

  let(:project_id) do
    project_repo.create(name: "Project", created_by_email: "system@example.com", organization_id: 1)
  end

  before do
    # The inter-service IAM calls need a bearer token; override the auth provider
    # with a fixed token so the real client code runs without a service-account
    # login round-trip.
    Api[:idah].add_auth(:bearer) do |request|
      request["Authorization"] = "Bearer test-token"
    end

    # The org_owner actor is a project_owner member of the project.
    member_repo.create(
      project_id: project_id,
      account_id: current_auth_context.metadata[:id],
      role: "project_owner",
      name: "Owner",
      email: current_auth_context.metadata[:email],
      invited_by_id: 1
    )
  end

  describe "POST /project_members/invite" do
    before do
      allow(Api[:idah].iam.accounts).to receive(:index).and_return(double(data: []))
      allow(Api[:idah].iam.accounts).to receive(:invite).and_return(
        double(id: 100, email: "new@test.com", name: "New Member", enabled: true, joined_at: nil)
      )
    end

    it "invites a member through the real service" do
      post "/project_members/invite",
           {
             project_id: project_id,
             members: [{ email: "new@test.com", role: "annotator" }]
           }

      expect(last_response.status).to eq 200
      invited = member_repo.find_by({ email: "new@test.com" })
      expect(invited).not_to be_nil
      expect(invited.role).to eq("annotator")
    end

    it "runs the real IAM client, deserialisation and membership write together" do
      # Do NOT stub `Api[:idah].iam.accounts.invite`: answer the HTTP boundary
      # with a realistic JSON:API account document so the real client code, the
      # deserialiser and the membership write all run end-to-end.
      allow(Api[:idah].iam.accounts).to receive(:index).and_return(double(data: []))

      stub_request(:post, "https://idah.example.com/iam/accounts/invite").
        with(
          body: {
            "email" => "new@test.com",
            "role_name" => "user",
            "role_scope" => {}
          }
        ).
        to_return(
          status: 200,
          body: JSON.generate(
            data: {
              type: "iam:accounts",
              id: "100",
              attributes: {
                email: "new@test.com",
                name: "New Member",
                role_name: "user",
                role_scope: {},
                enabled: true,
                joined_at: nil
              }
            }
          ),
          headers: { "Content-Type" => "application/json" }
        )

      post "/project_members/invite",
           {
             project_id: project_id,
             members: [{ email: "new@test.com", role: "annotator" }]
           }

      expect(last_response.status).to eq 200
      invited = member_repo.find_by({ email: "new@test.com" })
      expect(invited).not_to be_nil
      expect(invited.account_id).to eq(100)
      expect(invited.role).to eq("annotator")
      expect(invited.name).to eq("New Member")
    end
  end

  describe "POST /project_members/:id/resend_invitation" do
    let(:member_id) do
      member_repo.create(
        project_id: project_id,
        account_id: 100,
        role: "annotator",
        name: "Member",
        email: "member@test.com",
        invited_by_id: 1
      )
    end

    before do
      # Answer the IAM HTTP boundary with realistic JSON:API documents so the
      # real client code and deserialiser run. The resend response is the shape
      # the real IAM resend returns (id/name/email only), so a shape change on
      # either side fails this test.
      stub_request(:get, %r{/iam/accounts/100$}).
        to_return(
          status: 200,
          body: JSON.generate(
            data: {
              type: "iam:accounts",
              id: "100",
              attributes: {
                email: "member@test.com",
                name: "Member",
                enabled: true,
                joined_at: nil
              }
            }
          ),
          headers: { "Content-Type" => "application/json" }
        )
      stub_request(:post, %r{/iam/accounts/100/resend_invitation$}).
        to_return(
          status: 200,
          body: JSON.generate(
            data: {
              type: "iam:accounts",
              id: "100",
              attributes: {
                email: "member@test.com",
                name: "Member"
              }
            }
          ),
          headers: { "Content-Type" => "application/json" }
        )
    end

    it "resends through the real service" do
      post "/project_members/#{member_id}/resend_invitation"

      expect(last_response.status).to eq 200
      assert_requested(:post, %r{/iam/accounts/100/resend_invitation$})
    end
  end
end
