# frozen_string_literal: true

require "spec_helper"

RSpec.describe Entry, database: true do
  describe Entry::Repository do
    subject { described_class.new(Verse::Auth::Context.new) }

    it "can be instantiated" do
      expect(subject).to be_a(Entry::Repository)
    end

    let(:system_auth_context) { Verse::Auth::Context[:system] }
    let(:project_repo) { Project::Repository.new(system_auth_context) }
    let(:dataset_repo) { Dataset::Repository.new(system_auth_context) }
    let(:entry_repo) { described_class.new(system_auth_context) }

    let!(:project_id) do
      project_repo.create(
        name: "Test Project",
        description: "Test project",
        organization_id: 1,
        created_by_email: "admin@example.com"
      )
    end

    let!(:dataset_id) do
      dataset_repo.create(
        modality: "idah-image",
        labels: [],
        labeling_configuration: {},
        workflow_configuration: {},
        project_id: project_id
      )
    end

    describe "#custom_filter :assigned" do
      context "As Admin", as: :admin do
        subject { described_class.new(current_auth_context) }

        let!(:entry_assigned) do
          eid = entry_repo.create(
            priority: 1,
            wf_step: "annotate",
            status: "in_progress",
            project_id: project_id,
            dataset_id: dataset_id
          )
          entry_repo.assign(eid, 10, "assignee@example.com")
          eid
        end

        let!(:entry_unassigned) do
          entry_repo.create(
            priority: 1,
            wf_step: "annotate",
            status: "in_progress",
            project_id: project_id,
            dataset_id: dataset_id
          )
        end

        it "returns assigned entries when filter is true" do
          result = subject.index({ assigned: "true" })

          expect(result.size).to eq(1)
          expect(result.first.id).to eq(entry_assigned)
        end

        it "returns unassigned entries when filter is false" do
          result = subject.index({ assigned: "false" })

          expect(result.size).to eq(1)
          expect(result.first.id).to eq(entry_unassigned)
        end

        it "accepts boolean-like values" do
          result_true = subject.index({ assigned: true })
          expect(result_true.size).to eq(1)

          result_false = subject.index({ assigned: false })
          expect(result_false.size).to eq(1)
        end
      end
    end

    describe "#custom_filter :participated" do
      context "As Admin", as: :admin do
        subject { described_class.new(current_auth_context) }

        let!(:entry_participated) do
          eid = entry_repo.create(
            priority: 1,
            wf_step: "annotate",
            status: "in_progress",
            project_id: project_id,
            dataset_id: dataset_id
          )
          entry_repo.assign(eid, 42, "participant@example.com")
          eid
        end

        let!(:entry_not_participated) do
          entry_repo.create(
            priority: 1,
            wf_step: "annotate",
            status: "in_progress",
            project_id: project_id,
            dataset_id: dataset_id
          )
        end

        it "returns entries where the account participated (as assignee)" do
          result = subject.index({ participated: 42 })

          expect(result.size).to eq(1)
          expect(result.first.id).to eq(entry_participated)
        end

        it "does not return entries where the account is not a participant" do
          result = subject.index({ participated: 99 })

          expect(result).to be_empty
        end
      end
    end

    describe "#custom_filter :orphan_categories" do
      let(:stat_repo) { EntryStat::Repository.new(system_auth_context) }

      let!(:entry_with_orphans) do
        entry_repo.create(
          priority: 1,
          wf_step: "annotate",
          status: "in_progress",
          project_id: project_id,
          dataset_id: dataset_id
        )
      end

      let!(:entry_without_orphans) do
        entry_repo.create(
          priority: 1,
          wf_step: "annotate",
          status: "in_progress",
          project_id: project_id,
          dataset_id: dataset_id
        )
      end

      before do
        stat_repo.bulk_insert(
          entry_with_orphans,
          {
            "annotation.count" => "5",
            "category.cat.count" => "2",
            "orphan_category.count" => "3"
          }
        )

        stat_repo.bulk_insert(
          entry_without_orphans,
          {
            "annotation.count" => "1",
            "category.cat.count" => "1",
            "orphan_category.count" => "0"
          }
        )
      end

      context "As Admin", as: :admin do
        subject { described_class.new(current_auth_context) }

        it "returns entries with orphan categories when filter is true" do
          result = subject.index({ orphan_categories: "true" })

          expect(result.size).to eq(1)
          expect(result.first.id).to eq(entry_with_orphans)
        end

        it "returns entries without orphan categories when filter is false" do
          result = subject.index({ orphan_categories: "false" })

          expect(result.size).to eq(1)
          expect(result.first.id).to eq(entry_without_orphans)
        end

        it "includes entries that have no entry_stats row when filter is false" do
          entry_no_stats = entry_repo.create(
            priority: 1,
            wf_step: "annotate",
            status: "in_progress",
            project_id: project_id,
            dataset_id: dataset_id
          )

          result = subject.index({ orphan_categories: "false" })
          entry_ids = result.map(&:id)

          expect(result.size).to eq(2)
          expect(entry_ids).to include(entry_without_orphans)
          expect(entry_ids).to include(entry_no_stats)
        end

        it "accepts boolean-like values" do
          result_true = subject.index({ orphan_categories: true })
          expect(result_true.size).to eq(1)

          result_false = subject.index({ orphan_categories: false })
          expect(result_false.size).to eq(1)
        end
      end
    end
  end

  # Permission: Organization Owner acting through a membership on a FOREIGN project
  # ------------------------------------------------
  # An org_owner of Org A who is a member of a project in Org B is evaluated on
  # that project with their membership role, not org_owner powers. The `scoped`
  # union must follow the per-role rules exactly, and a disabled membership
  # grants nothing.
  describe "org_owner membership union", as: :org_owner do
    let(:system_context) { Verse::Auth::Context[:system] }
    let(:project_repo) { Project::Repository.new(system_context) }
    let(:project_member_repo) { ProjectMember::Repository.new(system_context) }
    let(:dataset_repo) { Dataset::Repository.new(system_context) }
    let(:entry_repo) { Entry::Repository.new(system_context) }

    let(:own_project_id) do
      project_repo.create(name: "Own Project", created_by_email: "system@example.com", organization_id: 1)
    end
    let(:own_dataset_id) do
      dataset_repo.create(
        name: "Own Dataset",
        project_id: own_project_id,
        modality: "video",
        workflow_configuration: {},
        labeling_configuration: {}
      )
    end
    let(:own_entry_id) do
      entry_repo.create(
        project_id: own_project_id,
        dataset_id: own_dataset_id,
        priority: 1,
        resource: "http://example.com/own.mp4",
        wf_step: "start",
        status: "pending"
      )
    end

    let(:foreign_project_id) do
      project_repo.create(name: "Foreign Project", created_by_email: "system@example.com", organization_id: 999)
    end
    let(:foreign_dataset_id) do
      dataset_repo.create(
        name: "Foreign Dataset",
        project_id: foreign_project_id,
        modality: "video",
        workflow_configuration: {},
        labeling_configuration: {}
      )
    end
    let(:foreign_entry_id) do
      entry_repo.create(
        project_id: foreign_project_id,
        dataset_id: foreign_dataset_id,
        priority: 1,
        resource: "http://example.com/foreign.mp4",
        wf_step: "start",
        status: "pending",
        assigned_to_id: current_auth_context.metadata[:id]
      )
    end

    subject { Entry::Repository.new(current_auth_context) }

    context "as a reviewer member of the foreign project" do
      before do
        project_member_repo.create(
          project_id: foreign_project_id,
          account_id: current_auth_context.metadata[:id],
          role: "reviewer",
          email: "org_owner@example.com",
          invited_by_id: 1
        )
      end

      it "reads the assigned foreign entry (reviewer read access via membership)" do
        own_entry_id
        foreign_entry_id

        result = subject.scoped(:read).all

        expect(result.map { |r| r[:id] }).to include(own_entry_id, foreign_entry_id)
      end

      it "cannot update or delete the foreign entry (reviewer has no update/delete right)" do
        foreign_entry_id

        expect(subject.scoped(:update).where(id: foreign_entry_id).all).to be_empty
        expect(subject.scoped(:delete).where(id: foreign_entry_id).all).to be_empty
      end

      it "grants nothing on the foreign project when the membership is disabled" do
        foreign_entry_id
        member = project_member_repo.find_by!(
          { project_id: foreign_project_id, account_id: current_auth_context.metadata[:id] }
        )
        project_member_repo.delete(member.id) # soft delete

        expect(subject.scoped(:read).where(id: foreign_entry_id).all).to be_empty
      end
    end

    context "as a project_owner member of the foreign project" do
      before do
        project_member_repo.create(
          project_id: foreign_project_id,
          account_id: current_auth_context.metadata[:id],
          role: "project_owner",
          email: "org_owner@example.com",
          invited_by_id: 1
        )
      end

      it "can read, update and delete the foreign entry (project_owner rank)" do
        foreign_entry_id

        expect(subject.scoped(:read).where(id: foreign_entry_id).all.map { |r| r[:id] }).to include(foreign_entry_id)
        expect(subject.scoped(:update).where(id: foreign_entry_id).all.map { |r| r[:id] }).to include(foreign_entry_id)
        expect(subject.scoped(:delete).where(id: foreign_entry_id).all.map { |r| r[:id] }).to include(foreign_entry_id)
      end
    end
  end
end
