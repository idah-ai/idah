# frozen_string_literal: true

# Shared fixtures for the annotation permission specs. Extracted unchanged from
# `permission_spec.rb` so the read-side history specs (`annotation_change/
# permission_spec.rb`) can assert that history visibility follows annotation
# visibility exactly, using the same projects, members, datasets, entries and
# annotations.
RSpec.shared_context "annotation permission fixtures" do
  let(:system_context) { Verse::Auth::Context[:system] }
  let(:project_repo) { Project::Repository.new(system_context) }
  let(:project_member_repo) { ProjectMember::Repository.new(system_context) }
  let(:dataset_repo) { Dataset::Repository.new(system_context) }
  let(:entry_repo) { Entry::Repository.new(system_context) }
  let(:annotation_repo) { Annotation::Repository.new(system_context) }

  # Projects
  let(:first_project_id) {
    project_repo.create(name: "Project 1", created_by_email: "system@example.com", organization_id: 1)
  }
  let(:second_project_id) {
    project_repo.create(name: "Project 2", created_by_email: "system@example.com", organization_id: 1)
  }
  let(:third_project_id) {
    project_repo.create(name: "Project 3", created_by_email: "system@example.com", organization_id: 1)
  }

  # Accounts IDs
  let(:project_owner_account_id) { 3 }
  let(:annotator_account_id) { 4 }
  let(:reviewer_account_id) { 5 }
  let(:another_annotator_account_id) { 6 }

  # Project Members
  let(:project_owner_member_id) {
    project_member_repo.create(
      project_id: first_project_id,
      account_id: project_owner_account_id,
      role: "project_owner",
      email: "project_owner@example.com",
      invited_by_id: 1
    )
  }
  let(:annotator_member_id) {
    project_member_repo.create(
      project_id: first_project_id,
      account_id: annotator_account_id,
      role: "annotator",
      email: "reviewer@example.com",
      invited_by_id: 1
    )
  }
  let(:reviewer_member_id) {
    project_member_repo.create(
      project_id: second_project_id,
      account_id: reviewer_account_id,
      role: "reviewer",
      email: "reviewer@example.com",
      invited_by_id: 1
    )
  }
  let(:another_annotator_member_id) {
    project_member_repo.create(
      project_id: third_project_id,
      account_id: another_annotator_account_id,
      role: "annotator",
      email: "annotator2@example.com",
      invited_by_id: 1
    )
  }

  # Datasets
  let(:first_dataset_id) {
    dataset_repo.create(
      name: "Dataset 1",
      project_id: first_project_id,
      modality: "video",
      workflow_configuration: {},
      labeling_configuration: {}
    )
  }
  let(:second_dataset_id) {
    dataset_repo.create(
      name: "Dataset 2",
      project_id: second_project_id,
      modality: "image",
      workflow_configuration: {},
      labeling_configuration: {}
    )
  }
  let(:third_dataset_id) {
    dataset_repo.create(
      name: "Dataset 3",
      project_id: third_project_id,
      modality: "video",
      workflow_configuration: {},
      labeling_configuration: {}
    )
  }

  # Entries
  let(:first_entry_id) {
    entry_repo.create(
      project_id: first_project_id,
      dataset_id: first_dataset_id,
      priority: 1,
      resource: "http://example.com/first.mp4",
      wf_step: "start",
      status: "pending",
      assigned_to_id: annotator_account_id
    )
  }
  let(:second_entry_id) {
    entry_repo.create(
      project_id: second_project_id,
      dataset_id: second_dataset_id,
      priority: 1,
      resource: "http://example.com/second.mp4",
      wf_step: "start",
      status: "pending",
      assigned_to_id: reviewer_account_id,
    )
  }
  let(:third_entry_id) {
    entry_repo.create(
      project_id: third_project_id,
      dataset_id: third_dataset_id,
      priority: 1,
      resource: "http://example.com/third.mp4",
      wf_step: "start",
      status: "pending",
      assigned_to_id: another_annotator_account_id,
    )
  }

  # Annotations
  let(:first_annotation_id) {
    annotation_repo.create(
      project_id: first_project_id,
      dataset_id: first_dataset_id,
      entry_id: first_entry_id,
      shape_type: "bb",
      shape_args: { x: 10, y: 20, width: 30, height: 40 },
      category: "cat",
      properties: {},
      created_by_email: "reviewer@example.com"
    )
  }
  let(:second_annotation_id) {
    annotation_repo.create(
      project_id: second_project_id,
      dataset_id: second_dataset_id,
      entry_id: second_entry_id,
      shape_type: "bb",
      shape_args: { x: 50, y: 60, width: 70, height: 80 },
      category: "dog",
      properties: {},
      created_by_email: "reviewer@example.com"
    )
  }
  let(:third_annotation_id) {
    annotation_repo.create(
      project_id: third_project_id,
      dataset_id: third_dataset_id,
      entry_id: third_entry_id,
      shape_type: "bb",
      shape_args: { x: 90, y: 100, width: 110, height: 120 },
      category: "mouse",
      properties: {},
      created_by_email: "annnotator2@example.com"
    )
  }

  let(:update_data) do
    {
      data: {
        type: "dataset:annotations",
        id: first_annotation_id,
        attributes: {
          shape_args: { x: 11, y: 21, width: 31, height: 41 },
          category: "mouse"
        }
      }
    }
  end

  let(:create_data) do
    {
      data: {
        type: "dataset:annotations",
        attributes: {
          shape_type: "bb",
          shape_args: { x: 10, y: 20, width: 30, height: 40 },
          category: "cat",
          properties: {},
          created_by_email: "annotator@example.com"
        },
        relationships: {
          entry: {
            data: {
              type: "dataset:entries",
              id: first_entry_id
            }
          }
        }
      }
    }
  end
end
