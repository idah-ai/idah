# frozen_string_literal: true

require "spec_helper"

RSpec.describe NoteFeed::Service, database: true do
  let(:system_context) { Verse::Auth::Context[:system] }
  let(:project_repo) { Project::Repository.new(system_context) }
  let(:project_member_repo) { ProjectMember::Repository.new(system_context) }
  let(:dataset_repo) { Dataset::Repository.new(system_context) }
  let(:entry_repo) { Entry::Repository.new(system_context) }
  let(:annotation_repo) { Annotation::Repository.new(system_context) }
  let(:note_feed_repo) { NoteFeed::Repository.new(system_context) }

  # Projects
  let(:first_project_id) {
    project_repo.create(name: "Project 1", created_by_email: "system@example.com")
  }
  let(:second_project_id) {
    project_repo.create(name: "Project 2", created_by_email: "system@example.com")
  }
  let(:third_project_id) {
    project_repo.create(name: "Project 3", created_by_email: "system@example.com")
  }

  # Accounts IDs
  let(:project_owner_account_id) { 3 }
  let(:annotator_account_id) { 4 }
  let(:reviewer_account_id) { 5 }
  let(:another_reviewer_account_id) { 6 }

  # Project Members
  let(:reviewer_other_member_id) {
    project_member_repo.create(
      project_id: second_project_id,
      account_id: reviewer_account_id,
      role: "reviewer",
      email: "reviewer@example.com",
      invited_by_id: 1
    )
  }

  # Datasets
  let(:first_dataset_id) {
    dataset_repo.create(
      name: "Dataset 1",
      project_id: first_project_id,
      modality: "video",
      labeling_configuration: { "width" => 100, "height" => 100 },
      workflow_configuration: { noteable_steps: ["review"] },
    )
  }
  let(:second_dataset_id) {
    dataset_repo.create(
      name: "Dataset 2",
      project_id: second_project_id,
      modality: "image",
      labeling_configuration: { "width" => 100, "height" => 100 },
      workflow_configuration: { noteable_steps: ["review"] },
    )
  }
  let(:third_dataset_id) {
    dataset_repo.create(
      name: "Dataset 3",
      project_id: third_project_id,
      modality: "image",
      labeling_configuration: { "width" => 100, "height" => 100 },
      workflow_configuration: { noteable_steps: ["review"] },
    )
  }

  # Entries
  let(:first_entry_id) {
    entry_repo.create(
      project_id: first_project_id,
      dataset_id: first_dataset_id,
      priority: 1,
      resource: "http://example.com/first.mp4",
      wf_step: "review",
      status: "in_progress",
      assigned_to_id: annotator_account_id,
    )
  }
  let(:second_entry_id) {
    entry_repo.create(
      project_id: second_project_id,
      dataset_id: second_dataset_id,
      priority: 1,
      resource: "http://example.com/second.mp4",
      wf_step: "review",
      status: "in_progress",
      assigned_to_id: reviewer_account_id,
    )
  }
  let(:third_entry_id) {
    entry_repo.create(
      project_id: third_project_id,
      dataset_id: third_dataset_id,
      priority: 1,
      resource: "http://example.com/second.mp4",
      wf_step: "review",
      status: "in_progress",
      assigned_to_id: reviewer_account_id,
    )
  }

  # Note Feeds
  let(:project_owner_note_feed_id) {
    note_feed_repo.create(
      project_id: first_project_id,
      dataset_id: first_dataset_id,
      entry_id: first_entry_id,
      anchor_type: "entry",
      position: { "x" => 100, "y" => 200 },
      content_md: "This is a first test note",
      created_by_email: "project_owner@example.com"
    )
  }
  let(:reviewer_note_feed_id) {
    note_feed_repo.create(
      project_id: first_project_id,
      dataset_id: first_dataset_id,
      entry_id: first_entry_id,
      anchor_type: "entry",
      position: { "x" => 100, "y" => 200 },
      content_md: "This is a second test note",
      created_by_email: "reviewer@example.com"
    )
  }
  let(:reviewer_other_note_feed_id) {
    note_feed_repo.create(
      project_id: second_project_id,
      dataset_id: second_dataset_id,
      entry_id: second_entry_id,
      anchor_type: "entry",
      position: { "x" => 100, "y" => 200 },
      content_md: "This is a second test note",
      created_by_email: "reviewer@example.com"
    )
  }
  let(:reviewer2_note_feed_id) {
    note_feed_repo.create(
      project_id: third_project_id,
      dataset_id: third_dataset_id,
      entry_id: third_entry_id,
      anchor_type: "entry",
      position: { "x" => 100, "y" => 200 },
      content_md: "This is a second test note",
      created_by_email: "reviewer2@example.com"
    )
  }

  let(:update_data) do
    {
      data: {
        type: "dataset:note_feeds",
        id: project_owner_note_feed_id,
        attributes: {
          position: { "x" => 300, "y" => 400 },
          content_md: "This is an updated test note"
        }
      }
    }
  end

  let(:create_attributes) do
    {
      entry_id: first_entry_id,
      anchor_type: "entry",
      position: { "x" => 100, "y" => 200 },
      content_md: "This is a test note",
      created_by_email: "reviewer@example.com"
    }
  end

  # Permission: Project Owner
  # ------------------------------------------------
  # Note Feeds    | index | create | update | delete
  # ------------------------------------------------
  # Assigned      |  yes  |  yes   |   own  |   own
  # Not Assigned  |   x   |   x    |    x   |    x
  context "as Project Owner", as: :project_owner do
    subject { described_class.new(current_auth_context) }

    before do
      # Add project owner member to first project
      project_member_repo.create(
        project_id: first_project_id,
        account_id: project_owner_account_id,
        role: "project_owner",
        email: "po@example.com",
        invited_by_id: 1
      )
    end

    describe "with assigned project" do
      it "can index" do
        all_ids = [project_owner_note_feed_id, reviewer_note_feed_id]

        result_ids = subject.index({}).map(&:id)

        expect(result_ids.count).to eq 2
        expect(result_ids).to contain_exactly(*all_ids)
        expect(result_ids).to_not include reviewer2_note_feed_id
      end

      it "can create" do
        record = subject.create_from_params(create_attributes)

        expect(record.project_id).to eq first_project_id
        expect(record.dataset_id).to eq first_dataset_id
        expect(record.entry_id).to eq first_entry_id
        expect(record.anchor_type).to eq "entry"
        expect(record.position).to eq({ x: 100, y: 200 })
        expect(record.content_md).to eq "This is a test note"
        expect(record.created_by_email).to eq "project_owner@example.com"
      end

      it "can update own note feed" do
        record = subject.update(deserialize(update_data))

        expect(record.project_id).to eq first_project_id
        expect(record.dataset_id).to eq first_dataset_id
        expect(record.entry_id).to eq first_entry_id
        expect(record.anchor_type).to eq "entry"
        expect(record.position).to eq({ x: 300, y: 400 })
        expect(record.content_md).to eq "This is an updated test note"
        expect(record.created_by_email).to eq "project_owner@example.com"
      end

      it "can delete own note feed" do
        subject.delete(project_owner_note_feed_id)

        expect {
          subject.show(project_owner_note_feed_id)
        }.to raise_error(Verse::Error::RecordNotFound)
      end

      it "cannot update others note feed" do
        update_data[:data][:id] = reviewer_note_feed_id

        expect {
          subject.update(deserialize(update_data))
        }.to raise_error(Verse::Error::RecordNotFound)
      end

      it "cannot delete others note feed" do
        expect {
          subject.delete(reviewer_note_feed_id)
        }.to raise_error(Verse::Error::RecordNotFound)
      end
    end

    describe "with not assigned project" do
      it "cannot index" do
        # Intialize note feeds
        _all_ids = [project_owner_note_feed_id, reviewer_note_feed_id, reviewer2_note_feed_id]

        result = subject.index({})

        expect(result.count).to eq 2
        expect(result.map(&:id)).to_not include reviewer2_note_feed_id
      end

      it "cannot create" do
        create_attributes[:entry_id] = third_entry_id

        expect {
          subject.create_from_params(create_attributes)
        }.to raise_error(Verse::Error::Unauthorized, "You do not have permission to add note feed")
      end

      it "cannot update" do
        update_data[:data][:id] = reviewer2_note_feed_id

        expect {
          subject.update(deserialize(update_data))
        }.to raise_error(Verse::Error::RecordNotFound)
      end

      it "cannot delete" do
        expect {
          subject.delete(reviewer2_note_feed_id)
        }.to raise_error(Verse::Error::RecordNotFound)
      end
    end
  end

  # Permission: Annotator
  # ------------------------------------------------
  # Note Feeds    | index | create | update | delete
  # ------------------------------------------------
  # Assigned      |  yes  |   x    |    x   |    x
  # Not Assigned  |   x   |   x    |    x   |    x
  context "as Annotator", as: :annotator do
    subject { described_class.new(current_auth_context) }

    before do
      project_member_repo.create(
        project_id: first_project_id,
        account_id: annotator_account_id,
        role: "annotator",
        email: "annotator@example.com",
        invited_by_id: 1
      )
    end

    describe "with assigned project and assigned entries" do
      it "can index" do
        all_ids = [project_owner_note_feed_id, reviewer_note_feed_id]
        result = subject.index({})

        expect(result.count).to eq 2
        expect(result.map(&:id)).to contain_exactly(*all_ids)
      end

      it "can create" do
        expect {
          subject.create_from_params(create_attributes)
        }.to raise_error(Verse::Error::Unauthorized, "You do not have permission to add note feed")
      end

      it "can update" do
        expect {
          subject.update(deserialize(update_data))
        }.to raise_error(Verse::Error::RecordNotFound)
      end

      it "can delete" do
        expect {
          subject.delete(project_owner_note_feed_id)
        }.to raise_error(Verse::Error::RecordNotFound)
      end
    end

    describe "with assigned project and not assigned entries" do
      before do
        # Add annotator member to third project
        project_member_repo.create(
          project_id: second_project_id,
          account_id: annotator_account_id,
          role: "annotator",
          email: "an@example.com",
          invited_by_id: 1
        )
      end

      it "cannot index" do
        _all_ids = [project_owner_note_feed_id, reviewer_note_feed_id, reviewer2_note_feed_id]

        # Ensure that the annotator is a member of the third project
        member = project_member_repo.find_by!({ account_id: annotator_account_id, project_id: second_project_id })
        expect(member.project_id).to eq second_project_id

        # Ensure that the annotator cannot see unassigned entries in the third project
        result = subject.index({})
        expect(result.count).to eq 2
        expect(result.map(&:id)).to_not include reviewer2_note_feed_id
      end

      it "cannot create" do
        create_attributes[:entry_id] = third_entry_id

        expect {
          subject.create_from_params(create_attributes)
        }.to raise_error(Verse::Error::Unauthorized, "You do not have permission to add note feed")
      end

      it "cannot update" do
        update_data[:data][:id] = project_owner_note_feed_id

        expect {
          subject.update(deserialize(update_data))
        }.to raise_error(Verse::Error::RecordNotFound)
      end

      it "cannot delete" do
        expect {
          subject.delete(project_owner_note_feed_id)
        }.to raise_error(Verse::Error::RecordNotFound)
      end
    end

    describe "with not assigned project" do
      it "cannot index" do
        _all_ids = [project_owner_note_feed_id, reviewer_note_feed_id, reviewer2_note_feed_id]

        result = subject.index({})

        expect(result.count).to eq 2
        expect(result.map(&:id)).to_not include reviewer2_note_feed_id
      end

      it "cannot create" do
        create_attributes[:entry_id] = second_entry_id

        expect {
          subject.create_from_params(create_attributes)
        }.to raise_error(Verse::Error::Unauthorized, "You do not have permission to add note feed")
      end

      it "cannot update" do
        update_data[:data][:id] = project_owner_note_feed_id

        expect {
          subject.update(deserialize(update_data))
        }.to raise_error(Verse::Error::RecordNotFound)
      end

      it "cannot delete" do
        expect {
          subject.delete(project_owner_note_feed_id)
        }.to raise_error(Verse::Error::RecordNotFound)
      end
    end
  end

  # Permission: Reviewer
  # ------------------------------------------------
  # Annotations   | index | create | update | delete
  # ------------------------------------------------
  # Assigned      |  yes  |  yes   |   own  |   own
  # Not Assigned  |   x   |   x    |    x   |    x
  context "as Reviewer", as: :reviewer do
    subject { described_class.new(current_auth_context) }

    before do
      project_member_repo.create(
        project_id: third_project_id,
        account_id: reviewer_account_id,
        role: "reviewer",
        email: "reviewer@example.com",
        invited_by_id: 1
      )
    end

    describe "with assigned project and assigned entries" do
      it "can index" do
        _all_ids = [
          project_owner_note_feed_id, reviewer_note_feed_id,
          reviewer_other_note_feed_id, reviewer2_note_feed_id
        ]

        result = subject.index({})

        expect(result.count).to eq 1
        expect(result.map(&:id)).to contain_exactly(reviewer2_note_feed_id)
      end

      it "can create" do
        create_attributes[:data][:relationships][:entry][:data][:id] = second_entry_id
        create_attributes[:data][:attributes][:created_by_email] = "reviewer@example.com"

        record = subject.create(deserialize(create_attributes))

        expect(record.project_id).to eq second_project_id
        expect(record.dataset_id).to eq second_dataset_id
        expect(record.entry_id).to eq second_entry_id
        expect(record.dimensions).to eq({ x: 10, y: 20, width: 30, height: 40 })
        expect(record.annotation).to eq({ label: "cat" })
        expect(record.created_by_email).to eq "reviewer@example.com"
      end

      it "can update" do
        update_data[:data][:id] = second_annotation_id

        record = subject.update(deserialize(update_data))

        expect(record.project_id).to eq second_project_id
        expect(record.dataset_id).to eq second_dataset_id
        expect(record.entry_id).to eq second_entry_id
        expect(record.dimensions).to eq({ x: 11, y: 21, width: 31, height: 41 })
        expect(record.annotation).to eq({ label: "mouse" })
      end

      it "can delete" do
        subject.delete(second_annotation_id)

        expect {
          subject.show(second_annotation_id)
        }.to raise_error(Verse::Error::RecordNotFound)
      end
    end

    describe "with assigned project and not assigned entries" do
      before do
        # Add reviewer member to third project
        project_member_repo.create(
          project_id: second_project_id,
          account_id: reviewer_account_id,
          role: "reviewer",
          email: "an@example.com",
          invited_by_id: 1
        )
      end

      it "cannot index" do
        # Ensure that the reviewer is a member of the third project
        member = project_member_repo.find_by!({ account_id: reviewer_account_id, project_id: second_dataset_id })
        expect(member.project_id).to eq second_dataset_id

        # Ensure that the reviewer cannot see unassigned entries in the third project
        result = subject.index({})
        expect(result.count).to eq 1
        expect(result.first.id).to_not eq third_annotation_id
      end

      it "cannot create" do
        create_attributes[:data][:relationships][:entry][:data][:id] = third_entry_id

        expect {
          subject.create(deserialize(create_attributes))
        }.to raise_error(Verse::Error::ValidationFailed, "entry not found to create an annotation")
      end

      it "cannot update" do
        update_data[:data][:id] = third_annotation_id

        expect {
          subject.update(deserialize(update_data))
        }.to raise_error(Verse::Error::RecordNotFound)
      end

      it "cannot delete" do
        expect {
          subject.delete(third_annotation_id)
        }.to raise_error(Verse::Error::RecordNotFound)
      end
    end

    describe "with not assigned project" do
      it "cannot index" do
        result = subject.index({})

        expect(result.count).to eq 1

        record = result.first
        expect(record.id).to_not eq first_annotation_id
      end

      it "cannot create" do
        create_attributes[:data][:relationships][:entry][:data][:id] = first_entry_id

        expect {
          subject.create(deserialize(create_attributes))
        }.to raise_error(Verse::Error::ValidationFailed, "entry not found to create an annotation")
      end

      it "cannot update" do
        update_data[:data][:id] = first_annotation_id

        expect {
          subject.update(deserialize(update_data))
        }.to raise_error(Verse::Error::RecordNotFound)
      end

      it "cannot delete" do
        expect {
          subject.delete(first_annotation_id)
        }.to raise_error(Verse::Error::RecordNotFound)
      end
    end
  end
end
