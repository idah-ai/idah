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

        context "with project scopes only (no org scopes)" do
          before do
            # Override custom_scopes to use project scopes instead of org scopes
            # This exercises the elsif project_ids branch
            allow(current_auth_context).to receive(:custom_scopes).and_return(
              { project: [project_org1] }
            )
          end

          it "returns project members scoped to the specified project for :read action" do
            result = subject.scoped(:read).all

            expect(result.size).to eq(3)

            expect(result.map { |r| r[:email] }).to match_array(
              %w[project_owner@example.com annotator@example.com reviewer@example.com]
            )
          end

          it "does not include members from other projects" do
            result = subject.scoped(:read).all

            expect(result.map { |r| r[:project_id] }).to all(eq(project_org1))
          end
        end

        context "with neither org nor project scopes" do
          before do
            allow(current_auth_context).to receive(:custom_scopes).and_return({})
          end

          it "returns no results (Sequel.lit false)" do
            result = subject.scoped(:read).all

            expect(result.size).to eq(0)
          end
        end
      end
    end

    describe "#custom_filter :organization_id__in" do
      context "As Admin", as: :admin do
        subject { described_class.new(system_auth_context) }

        it "filters by organization id" do
          result = subject.index({ organization_id__in: ["1"] })

          expect(result.size).to eq(3)
          expect(result.map { |r| r[:email] }).to match_array(
            %w[project_owner@example.com annotator@example.com reviewer@example.com]
          )
        end

        it "filters by multiple organization ids" do
          result = subject.index({ organization_id__in: %w[1 2] })

          expect(result.size).to eq(4)
        end

        it "returns no results for non-existent organization" do
          result = subject.index({ organization_id__in: ["999"] })

          expect(result.size).to eq(0)
        end
      end
    end

    describe "#custom_filter :enabled" do
      context "As Admin", as: :admin do
        subject { described_class.new(system_auth_context) }

        let!(:disabled_member) do
          member = project_member_repo.create(
            project_id: project_org1,
            account_id: 99,
            name: "Disabled User",
            email: "disabled@example.com",
            role: "annotator",
            invited_by_id: 1
          )
          project_member_repo.update!(member, { disabled_at: Time.now })
          project_member_repo.find!(member)
        end

        it "returns only enabled members when filter is true" do
          result = subject.index({ enabled: "true" })

          expect(result.map { |r| r[:email] }).not_to include("disabled@example.com")
          result.each do |member|
            expect(member.disabled_at).to be_nil
          end
        end

        it "returns only disabled members when filter is false" do
          result = subject.index({ enabled: "false" })

          expect(result.size).to eq(1)
          expect(result[0].email).to eq("disabled@example.com")
          expect(result[0].disabled_at).not_to be_nil
        end

        it "treats any value other than the literal string \"true\" as false" do
          ["1", "yes", "garbage"].each do |value|
            result = subject.index({ enabled: value })

            expect(result.map { |r| r[:email] }).to eq(["disabled@example.com"]),
                                                    "expected #{value.inspect} to select the disabled branch"
          end
        end
      end
    end
  end
end
