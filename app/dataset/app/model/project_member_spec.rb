# frozen_string_literal: true

require "spec_helper"

RSpec.describe ProjectMember, database: true do
  describe ProjectMember::Repository do
    subject { described_class.new(Verse::Auth::Context.new) }

    it "can be instantiated" do
      expect(subject).to be_a(ProjectMember::Repository)
    end

    # Use system context to create test data without scoping restrictions
    let(:system_auth_context) { Verse::Auth::Context[:system] }
    let(:project_repo) { Project::Repository.new(system_auth_context) }
    let(:project_member_repo) { described_class.new(system_auth_context) }

    let!(:project_org1) do
      project_repo.create(
        name: "Project Org 1",
        description: "Test project in organization 1",
        organization_id: 1,
        created_by_email: "admin@example.com"
      )
    end

    let!(:project_org2) do
      project_repo.create(
        name: "Project Org 2",
        description: "Test project in organization 2",
        organization_id: 2,
        created_by_email: "admin@example.com"
      )
    end

    let!(:pm_project_owner_org1) do
      project_member_repo.create(
        project_id: project_org1,
        account_id: 3,
        name: "Project Owner User",
        email: "project_owner@example.com",
        role: "project_owner",
        invited_by_id: 1
      )
    end

    let!(:pm_annotator_org1) do
      project_member_repo.create(
        project_id: project_org1,
        account_id: 4,
        name: "Annotator User",
        email: "annotator@example.com",
        role: "annotator",
        invited_by_id: 1
      )
    end

    let!(:pm_reviewer_org1) do
      project_member_repo.create(
        project_id: project_org1,
        account_id: 5,
        name: "Reviewer User",
        email: "reviewer@example.com",
        role: "reviewer",
        invited_by_id: 1
      )
    end

    let!(:pm_project_owner_org2) do
      project_member_repo.create(
        project_id: project_org2,
        account_id: 3,
        name: "Project Owner User",
        email: "project_owner2@example.com",
        role: "project_owner",
        invited_by_id: 1
      )
    end

    describe "#scoped" do
      context "As Admin", as: :admin do
        subject { described_class.new(current_auth_context) }

        it "returns all project members for :read action" do
          result = subject.scoped(:read).all

          expect(result.size).to eq(4)

          expect(result.map { |r| r[:email] }).to match_array(
            %w[project_owner@example.com annotator@example.com reviewer@example.com project_owner2@example.com]
          )
        end

        it "returns all project members for :create action" do
          result = subject.scoped(:create).all

          expect(result.size).to eq(4)
        end

        it "returns all project members for :update action" do
          result = subject.scoped(:update).all

          expect(result.size).to eq(4)
        end

        it "returns all project members for :delete action" do
          result = subject.scoped(:delete).all

          expect(result.size).to eq(4)
        end
      end

      context "As Org Owner", as: :org_owner do
        subject { described_class.new(current_auth_context) }

        # org_owner has scopes: { org: ["1"] }
        # So they should only see project members in organization 1 projects

        it "returns project members scoped to organization for :read action" do
          result = subject.scoped(:read).all

          expect(result.size).to eq(3)

          expect(result.map { |r| r[:email] }).to match_array(
            %w[project_owner@example.com annotator@example.com reviewer@example.com]
          )
        end
      end
    end
  end
end
