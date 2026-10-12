# frozen_string_literal: true

require "spec_helper"

RSpec.describe Medias::Repository, database: true do
  let(:org_a) { "org-a" }
  let(:org_b) { "org-b" }
  let(:project_a) { "project-a" }
  let(:project_b) { "project-b" }

  def build_org_owner_context(orgs)
    Verse::Auth::Context.new(
      ["media:medias.*.as_org_owner"],
      role: "org_owner",
      custom_scopes: { org: orgs },
      metadata: { id: 2, email: "owner@test.com", name: "Owner", role: :org_owner }
    )
  end

  def create_media(repo, project_id, resource)
    repo.create(
      id: UUIDv7.generate,
      resource: resource,
      key: "key-#{resource}",
      filename: "#{resource}.mp4",
      size: 1024,
      mime_type: "video/mp4",
      created_by: 2,
      created_role: "org_owner",
      project_id: project_id
    )
  end

  context "as an org_owner" do
    subject { described_class.new(build_org_owner_context([org_a])) }

    before do
      # The org_owner scope resolves the actor's org projects via the dataset
      # service, through ProjectMembership::Lookup.
      lookup = double(ProjectMembership::Lookup)
      allow(ProjectMembership::Lookup).to receive(:new).and_return(lookup)
      allow(lookup).to receive(:project_ids_for_organizations).with([org_a]).and_return([project_a])
      allow(lookup).to receive(:memberships_for).with(2).and_return([])
    end

    it "only exposes media belonging to the actor's own org projects" do
      create_media(subject, project_a, "media-a")
      create_media(subject, project_b, "media-b")

      result = subject.index({})

      expect(result.map(&:resource)).to eq(["media-a"])
    end

    it "also exposes media on a foreign project where the actor is an enabled member" do
      create_media(subject, project_a, "media-a")
      create_media(subject, project_b, "media-b")

      allow(ProjectMembership::Lookup).to receive(:new).and_return(
        double(
          project_ids_for_organizations: [project_a],
          memberships_for: [double(project_id: project_b, role: "reviewer", organization_id: "org-b")]
        )
      )

      result = subject.index({})

      expect(result.map(&:resource)).to contain_exactly("media-a", "media-b")
    end
  end
end