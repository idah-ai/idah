# frozen_string_literal: true

require "spec_helper"

RSpec.describe Annotation, database: true do
  describe Annotation::Repository do
    subject{ described_class.new(Verse::Auth::Context.new) }

    it "can be instantiated" do
      expect(subject).to be_a(Annotation::Repository)
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
    let(:annotation_repo) { Annotation::Repository.new(system_context) }

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
    let(:own_annotation_id) do
      annotation_repo.create(
        project_id: own_project_id,
        dataset_id: own_dataset_id,
        entry_id: own_entry_id,
        shape_type: "bb",
        shape_args: { x: 1 },
        category: "cat",
        properties: {},
        created_by_email: "org_owner@example.com"
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
    let(:foreign_annotation_id) do
      annotation_repo.create(
        project_id: foreign_project_id,
        dataset_id: foreign_dataset_id,
        entry_id: foreign_entry_id,
        shape_type: "bb",
        shape_args: { x: 2 },
        category: "dog",
        properties: {},
        created_by_email: "org_owner@example.com"
      )
    end

    subject { Annotation::Repository.new(current_auth_context) }

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

      it "reads the assigned foreign entry's annotation (reviewer read access via membership)" do
        own_annotation_id
        foreign_annotation_id

        result = subject.scoped(:read).all

        expect(result.map { |r| r[:id] }).to include(own_annotation_id, foreign_annotation_id)
      end

      it "can update and delete the foreign annotation (annotator/reviewer share these rights)" do
        foreign_annotation_id

        expect(
          subject.scoped(:update).where(id: foreign_annotation_id).all.map { |r|
            r[:id]
          }
        ).to include(foreign_annotation_id)
        expect(
          subject.scoped(:delete).where(id: foreign_annotation_id).all.map { |r|
            r[:id]
          }
        ).to include(foreign_annotation_id)
      end

      it "grants nothing on the foreign project when the membership is disabled" do
        foreign_annotation_id
        member = project_member_repo.find_by!(
          { project_id: foreign_project_id, account_id: current_auth_context.metadata[:id] }
        )
        project_member_repo.delete(member.id) # soft delete

        expect(subject.scoped(:read).where(id: foreign_annotation_id).all).to be_empty
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

      it "can read, update and delete the foreign annotation (project_owner rank)" do
        foreign_annotation_id

        expect(
          subject.scoped(:read).where(id: foreign_annotation_id).all.map { |r|
            r[:id]
          }
        ).to include(foreign_annotation_id)
        expect(
          subject.scoped(:update).where(id: foreign_annotation_id).all.map { |r|
            r[:id]
          }
        ).to include(foreign_annotation_id)
        expect(
          subject.scoped(:delete).where(id: foreign_annotation_id).all.map { |r|
            r[:id]
          }
        ).to include(foreign_annotation_id)
      end
    end
  end
end
