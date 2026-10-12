# frozen_string_literal: true

require_relative "../lib/api"
require_relative "../lib/resource/dataset"
require_relative "../lib/project_membership/cache"
require_relative "../lib/project_membership/lookup"

RSpec.describe ProjectMembership::Lookup do
  subject { described_class.new }

  let(:dataset) { Api[:idah].dataset }

  before do
    # Use a disabled cache so the lookup behaves as a passthrough (Step 9
    # semantics); cache behaviour is covered by the cache spec.
    subject.cache = ProjectMembership::Cache.new(enabled: false)
  end

  describe "#memberships_for" do
    it "returns enabled memberships with project, role and organization id" do
      allow(dataset.project_members).to receive(:index_all).with(
        filter: { account_id: 42, enabled: true },
        fields: { "dataset:project_members" => %w[project_id role] },
        included: ["project"]
      ).and_return(
        [
          double(project_id: "p1", role: "reviewer", project: double(organization_id: 7)),
          double(project_id: "p2", role: "annotator", project: double(organization_id: 8))
        ]
      )

      result = subject.memberships_for(42)

      expect(result.map(&:project_id)).to eq(%w[p1 p2])
      expect(result.map(&:role)).to eq(%w[reviewer annotator])
      expect(result.map(&:organization_id)).to eq([7, 8])
    end

    it "skips memberships whose project could not be resolved" do
      allow(dataset.project_members).to receive(:index_all).and_return(
        [double(project_id: "p1", role: "reviewer", project: nil)]
      )

      expect(subject.memberships_for(42)).to be_empty
    end

    it "resolves organization_id through the real dataset response shape (sparse fields + include)" do
      # The dataset endpoint returns a JSON:API document: project_members with
      # sparse fields (project_id, role) and the included project carrying
      # organization_id. Deserialize it exactly as the API client would.
      document = {
        data: [
          {
            type: "dataset:project_members",
            id: "pm1",
            attributes: { project_id: "p1", role: "reviewer" },
            relationships: { project: { data: { type: "dataset:projects", id: "p1" } } }
          }
        ],
        included: [
          { type: "dataset:projects", id: "p1", attributes: { organization_id: 7 } }
        ]
      }
      memberships = Verse::JsonApi::Deserializer.deserialize(document).data
      allow(dataset.project_members).to receive(:index_all).with(
        filter: { account_id: 42, enabled: true },
        fields: { "dataset:project_members" => %w[project_id role] },
        included: ["project"]
      ).and_return(memberships)

      result = subject.memberships_for(42)

      expect(result.length).to eq(1)
      expect(result.first.project_id).to eq("p1")
      expect(result.first.role).to eq("reviewer")
      expect(result.first.organization_id).to eq(7)
    end
  end

  describe "#member_account_ids" do
    it "returns enabled member account ids for the given projects (composed per project)" do
      allow(dataset.project_members).to receive(:index_all).with(
        filter: { project_id__in: ["p1"], enabled: true },
        fields: { "dataset:project_members" => %w[account_id] }
      ).and_return([double(account_id: 1), double(account_id: 2)])
      allow(dataset.project_members).to receive(:index_all).with(
        filter: { project_id__in: ["p2"], enabled: true },
        fields: { "dataset:project_members" => %w[account_id] }
      ).and_return([double(account_id: 2)])

      expect(subject.member_account_ids(project_ids: %w[p1 p2])).to eq([1, 2])
    end

    it "returns [] for empty project ids without querying" do
      expect(dataset.project_members).not_to receive(:index_all)
      expect(subject.member_account_ids(project_ids: [])).to eq([])
    end
  end

  describe "#member_account_ids(organization_ids:)" do
    it "returns enabled member account ids for the projects of the given organizations (composed per org)" do
      allow(dataset.project_members).to receive(:index_all).with(
        filter: { organization_id__in: ["7"], enabled: true },
        fields: { "dataset:project_members" => %w[account_id] }
      ).and_return([double(account_id: 3)])
      allow(dataset.project_members).to receive(:index_all).with(
        filter: { organization_id__in: ["8"], enabled: true },
        fields: { "dataset:project_members" => %w[account_id] }
      ).and_return([double(account_id: 4)])

      expect(subject.member_account_ids(organization_ids: %w[7 8])).to eq([3, 4])
    end

    it "returns [] for empty organization ids without querying" do
      expect(dataset.project_members).not_to receive(:index_all)
      expect(subject.member_account_ids(organization_ids: [])).to eq([])
    end
  end

  describe "#project_ids_for_organizations" do
    it "returns the ids of the projects belonging to the given organizations (composed per org)" do
      allow(dataset.projects).to receive(:index_all).with(
        filter: { organization_id: ["7"] },
        fields: { "dataset:projects" => %w[id] }
      ).and_return([double(id: "p1"), double(id: "p2")])
      allow(dataset.projects).to receive(:index_all).with(
        filter: { organization_id: ["8"] },
        fields: { "dataset:projects" => %w[id] }
      ).and_return([double(id: "p1")])

      expect(subject.project_ids_for_organizations(%w[7 8])).to eq(%w[p1 p2])
    end

    it "returns [] for empty org ids without querying" do
      expect(dataset.projects).not_to receive(:index_all)
      expect(subject.project_ids_for_organizations([])).to eq([])
    end
  end
end