# frozen_string_literal: true

require "spec_helper"

# DB-backed request spec for GET /project_members with filter[project_id__in],
# exercising the real ProjectMember::Service through the HTTP layer (no service
# mock). Proves the filter is applied and members of other projects are excluded.
RSpec.describe ProjectMembersExpo, type: :exposition, as: :system, database: true do
  let(:system_context) { Verse::Auth::Context[:system] }
  let(:project_repo) { Project::Repository.new(system_context) }
  let(:member_repo) { ProjectMember::Repository.new(system_context) }

  let!(:project_a) do
    project_repo.create(name: "Project A", created_by_email: "system@example.com", organization_id: 1)
  end
  let!(:project_b) do
    project_repo.create(name: "Project B", created_by_email: "system@example.com", organization_id: 2)
  end

  before do
    member_repo.create(project_id: project_a, account_id: 1, role: "annotator", name: "A1", email: "a1@test.com", invited_by_id: 1)
    member_repo.create(project_id: project_a, account_id: 2, role: "reviewer", name: "A2", email: "a2@test.com", invited_by_id: 1)
    member_repo.create(project_id: project_b, account_id: 3, role: "annotator", name: "B1", email: "b1@test.com", invited_by_id: 1)
  end

  it "returns only members of the given project" do
    get "/project_members?filter[project_id__in][]=#{project_a}"

    expect(last_response.status).to eq 200
    body = JSON.parse(last_response.body, symbolize_names: true)
    records = body[:data]

    expect(records.map { |r| r[:attributes][:email] }).to match_array(%w[a1@test.com a2@test.com])
  end

  it "returns members across multiple projects" do
    get "/project_members?filter[project_id__in][]=#{project_a}&filter[project_id__in][]=#{project_b}"

    expect(last_response.status).to eq 200
    body = JSON.parse(last_response.body, symbolize_names: true)
    records = body[:data]

    expect(records.size).to eq(3)
  end
end