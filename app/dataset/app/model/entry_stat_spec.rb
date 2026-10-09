# frozen_string_literal: true

require "spec_helper"

RSpec.describe EntryStat, database: true do
  describe EntryStat::Repository do
    subject { described_class.new(Verse::Auth::Context.new) }

    it "can be instantiated" do
      expect(subject).to be_a(EntryStat::Repository)
    end

    # Use system context to create test data without scoping restrictions
    let(:system_auth_context) { Verse::Auth::Context[:system] }
    let(:project_repo) { Project::Repository.new(system_auth_context) }
    let(:dataset_repo) { Dataset::Repository.new(system_auth_context) }
    let(:entry_repo) { Entry::Repository.new(system_auth_context) }
    let(:project_member_repo) { ProjectMember::Repository.new(system_auth_context) }
    let(:stat_repo) { described_class.new(system_auth_context) }

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

    let!(:dataset_org1) do
      dataset_repo.create(
        modality: "image_labeling",
        labels: [],
        labeling_configuration: {},
        workflow_configuration: {},
        project_id: project_org1
      )
    end

    let!(:dataset_org2) do
      dataset_repo.create(
        modality: "image_labeling",
        labels: [],
        labeling_configuration: {},
        workflow_configuration: {},
        project_id: project_org2
      )
    end

    let!(:entry_org1) do
      entry_repo.create(
        priority: 1,
        wf_step: "annotate",
        status: "in_progress",
        project_id: project_org1,
        dataset_id: dataset_org1
      )
    end

    let!(:entry_org2) do
      entry_repo.create(
        priority: 1,
        wf_step: "annotate",
        status: "in_progress",
        project_id: project_org2,
        dataset_id: dataset_org2
      )
    end

    let!(:stat_org1) do
      stat_repo.bulk_insert(
        entry_org1,
        { "annotation.count" => "5", "category.cat.count" => "3" }
      )
      stat_repo.index({ entry_id__eq: entry_org1 }).first
    end

    let!(:stat_org2) do
      stat_repo.bulk_insert(
        entry_org2,
        { "annotation.count" => "2" }
      )
      stat_repo.index({ entry_id__eq: entry_org2 }).first
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
        account_id: 6,
        name: "Project Owner User",
        email: "project_owner2@example.com",
        role: "project_owner",
        invited_by_id: 1
      )
    end

    describe "#scoped" do
      context "As Admin", as: :admin do
        subject { described_class.new(current_auth_context) }

        it "returns all entry_stats for :read action" do
          result = subject.scoped(:read).all

          expect(result.size).to eq(3)

          expect(result.map { |r| r[:key] }).to match_array(
            %w[annotation.count category.cat.count annotation.count]
          )
        end
      end

      context "As Org Owner", as: :org_owner do
        subject { described_class.new(current_auth_context) }

        # org_owner has scopes: { org: ["1"] }
        # So they should only see entry_stats in organization 1 projects

        it "returns entry_stats scoped to organization for :read action" do
          result = subject.scoped(:read).all

          expect(result.size).to eq(2)

          expect(result.map { |r| r[:key] }).to match_array(
            %w[annotation.count category.cat.count]
          )
        end

        context "with project scopes only (no org scopes)" do
          before do
            allow(current_auth_context).to receive(:custom_scopes).and_return(
              { project: [project_org1] }
            )
          end

          it "returns entry_stats scoped to the specified project for :read action" do
            result = subject.scoped(:read).all

            expect(result.size).to eq(2)

            expect(result.map { |r| r[:key] }).to match_array(
              %w[annotation.count category.cat.count]
            )
          end

          it "does not include stats from other projects" do
            result = subject.scoped(:read).all

            expect(result.map { |r| r[:entry_id] }).to all(eq(entry_org1))
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

      context "As Project Owner", as: :project_owner do
        subject { described_class.new(current_auth_context) }

        it "returns entry_stats for all entries in the project for :read action" do
          result = subject.scoped(:read).all

          expect(result.size).to eq(2)

          expect(result.map { |r| r[:key] }).to match_array(
            %w[annotation.count category.cat.count]
          )
        end

        it "does not return stats from other projects" do
          result = subject.scoped(:read).all

          expect(result.map { |r| r[:entry_id] }).to all(eq(entry_org1))
        end
      end

      context "As Annotator (assigned)", as: :annotator do
        subject { described_class.new(current_auth_context) }

        before do
          entry_repo.assign(entry_org1, 4, "annotator@example.com")
        end

        it "returns only stats for entries assigned to the annotator for :read action" do
          result = subject.scoped(:read).all

          expect(result.size).to eq(2)

          expect(result.map { |r| r[:key] }).to match_array(
            %w[annotation.count category.cat.count]
          )
        end
      end

      context "As Annotator (unassigned)", as: :annotator do
        subject { described_class.new(current_auth_context) }

        it "sees no stats when not assigned to any entry" do
          result = subject.scoped(:read).all

          expect(result.size).to eq(0)
        end
      end

      context "As Reviewer (assigned)", as: :reviewer do
        subject { described_class.new(current_auth_context) }

        before do
          entry_repo.assign(entry_org1, 5, "reviewer@example.com")
        end

        it "returns only stats for entries assigned to the reviewer for :read action" do
          result = subject.scoped(:read).all

          expect(result.size).to eq(2)

          expect(result.map { |r| r[:key] }).to match_array(
            %w[annotation.count category.cat.count]
          )
        end
      end

      context "for non-read actions", as: :project_owner do
        subject { described_class.new(current_auth_context) }

        it "raises Unauthorized for :create action" do
          expect { subject.scoped(:create).all }.
            to raise_error(Verse::Error::Unauthorized, /unauthorized action `create` on `dataset:entry_stats`/)
        end

        it "raises Unauthorized for :update action" do
          expect { subject.scoped(:update).all }.
            to raise_error(Verse::Error::Unauthorized, /unauthorized action `update` on `dataset:entry_stats`/)
        end

        it "raises Unauthorized for :delete action" do
          expect { subject.scoped(:delete).all }.
            to raise_error(Verse::Error::Unauthorized, /unauthorized action `delete` on `dataset:entry_stats`/)
        end
      end
    end
  end
end
