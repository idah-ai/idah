# frozen_string_literal: true

require "spec_helper"

RSpec.describe NoteComment::Service, database: true do
  let(:system_context) { Verse::Auth::Context[:system] }
  let(:project_repo) { Project::Repository.new(system_context) }
  let(:project_member_repo) { ProjectMember::Repository.new(system_context) }
  let(:dataset_repo) { Dataset::Repository.new(system_context) }
  let(:entry_repo) { Entry::Repository.new(system_context) }
  let(:annotation_repo) { Annotation::Repository.new(system_context) }
  let(:note_feed_repo) { NoteFeed::Repository.new(system_context) }
  let(:note_comment_repo) { NoteComment::Repository.new(system_context) }

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

  # Project Members
  let(:project_owner_member_id) {
    project_member_repo.create(
      project_id: first_project_id,
      account_id: project_owner_account_id,
      role: "project_owner",
      name: "Project Owner",
      email: "project_owner@example.com",
      invited_by_id: 1
    )
  }
  let(:annotator_member_id) {
    project_member_repo.create(
      project_id: first_project_id,
      account_id: annotator_account_id,
      role: "annotator",
      name: "Annotator",
      email: "annotator@example.com",
      invited_by_id: 1
    )
  }
  let(:reviewer_member_id) {
    project_member_repo.create(
      project_id: second_project_id,
      account_id: reviewer_account_id,
      role: "reviewer",
      name: "Reviewer",
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
  let(:annotator_note_feed_id) {
    note_feed_repo.create(
      project_id: first_project_id,
      dataset_id: first_dataset_id,
      entry_id: first_entry_id,
      anchor_type: "entry",
      position: { "x" => 100, "y" => 200 },
      content_md: "This is a second test note",
      created_by_email: "annotator@example.com"
    )
  }
  let(:reviewer_first_note_feed_id) {
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
  let(:reviewer_second_note_feed_id) {
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
  let(:reviewer_third_note_feed_id) {
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
  let(:other_note_feed_id) {
    note_feed_repo.create(
      project_id: third_project_id,
      dataset_id: third_dataset_id,
      entry_id: third_entry_id,
      anchor_type: "entry",
      position: { "x" => 100, "y" => 200 },
      content_md: "This is a second test note",
      created_by_email: "other@example.com"
    )
  }

  # Note Feed Comments
  let(:project_owner_note_comment_id) {
    note_comment_repo.create(
      note_feed_id: project_owner_note_feed_id,
      content_md: "This is a test note comment",
      created_by_email: "project_owner@example.com"
    )
  }
  let(:annotator_note_comment_id) {
    note_comment_repo.create(
      note_feed_id: annotator_note_feed_id,
      content_md: "This is a test note comment",
      created_by_email: "annotator@example.com"
    )
  }
  let(:reviewer_first_note_comment_id) {
    note_comment_repo.create(
      note_feed_id: reviewer_first_note_feed_id,
      content_md: "This is a test note comment",
      created_by_email: "reviewer@example.com"
    )
  }
  let(:reviewer_second_note_comment_id) {
    note_comment_repo.create(
      note_feed_id: reviewer_second_note_feed_id,
      content_md: "This is a test note comment",
      created_by_email: "reviewer@example.com",
    )
  }
  let(:reviewer_third_note_comment_id) {
    note_comment_repo.create(
      note_feed_id: reviewer_third_note_feed_id,
      content_md: "This is a test note comment",
      created_by_email: "reviewer@example.com"
    )
  }
  let(:other_note_comment_id) {
    note_comment_repo.create(
      note_feed_id: other_note_feed_id,
      content_md: "This is a test note comment",
      created_by_email: "other@example.com"
    )
  }

  let(:update_data) do
    {
      data: {
        type: "dataset:note_comments",
        id: project_owner_note_comment_id,
        attributes: {
          content_md: "This is an updated test note comment"
        }
      }
    }
  end

  let(:create_data) do
    {
      data: {
        type: "dataset:note_comments",
        attributes: {
          content_md: "This is a created test note comment"
        },
        relationships: {
          note_feed: {
            data: { type: "dataset:note_feeds", id: project_owner_note_feed_id }
          }
        }
      }
    }
  end

  # Permission: Project Owner
  # ------------------------------------------------
  # Note Comments | index | create | update | delete
  # ------------------------------------------------
  # Assigned      |  yes  |  yes   |   own  |   own
  # Not Assigned  |   x   |   x    |    x   |    x
  context "as Project Owner", as: :project_owner do
    subject { described_class.new(current_auth_context) }

    before do
      project_owner_member_id # Assign user to project
    end

    describe "with assigned project" do
      it "can index" do
        # Setup: create note comments to test visibility
        project_owner_note_comment_id # assigned
        annotator_note_comment_id # assigned
        reviewer_first_note_comment_id # assigned
        reviewer_second_note_comment_id # assigned
        reviewer_third_note_comment_id # not assigned
        other_note_comment_id # not assigned

        result_ids = subject.index({}).map(&:id)

        expect(result_ids.count).to eq 4
        expect(result_ids).to contain_exactly(
          project_owner_note_comment_id,
          annotator_note_comment_id,
          reviewer_first_note_comment_id,
          reviewer_second_note_comment_id
        )
      end

      it "can create" do
        record = subject.create(deserialize(create_data))

        expect(record.note_feed_id).to eq project_owner_note_feed_id
        expect(record.content_md).to eq "This is a created test note comment"
        expect(record.created_by_email).to eq "project_owner@example.com"
      end

      it "can update own note feed comment" do
        record = subject.update(deserialize(update_data))

        expect(record.note_feed_id).to eq project_owner_note_feed_id
        expect(record.content_md).to eq "This is an updated test note comment"
        expect(record.created_by_email).to eq "project_owner@example.com"
      end

      it "can delete own note feed comment" do
        subject.delete(project_owner_note_comment_id)

        expect {
          subject.show(project_owner_note_comment_id)
        }.to raise_error(Verse::Error::RecordNotFound)
      end

      it "cannot update others note feed comment" do
        update_data[:data][:id] = reviewer_first_note_comment_id

        expect {
          subject.update(deserialize(update_data))
        }.to raise_error(Verse::Error::RecordNotFound)
      end

      it "cannot delete others note feed comment" do
        expect {
          subject.delete(reviewer_first_note_comment_id)
        }.to raise_error(Verse::Error::RecordNotFound)
      end
    end

    describe "with not assigned project" do
      it "cannot index" do
        # Setup: create note feeds to test visibility
        project_owner_note_comment_id # assigned
        annotator_note_comment_id # assigned
        reviewer_first_note_comment_id # assigned
        reviewer_second_note_comment_id # assigned
        reviewer_third_note_comment_id # not assigned
        other_note_comment_id # not assigned

        result = subject.index({})

        expect(result.count).to eq 4
        expect(result.map(&:id)).to_not include reviewer_third_note_feed_id, other_note_feed_id
      end

      it "cannot create" do
        create_data[:data][:relationships][:note_feed][:data][:id] = reviewer_third_note_feed_id

        expect {
          subject.create(deserialize(create_data))
        }.to raise_error(
          Verse::Error::ValidationFailed,
          "note feed not found to create a comment"
        )
      end

      it "cannot update" do
        update_data[:data][:id] = reviewer_third_note_comment_id

        expect {
          subject.update(deserialize(update_data))
        }.to raise_error(Verse::Error::RecordNotFound)
      end

      it "cannot delete" do
        expect {
          subject.delete(reviewer_third_note_comment_id)
        }.to raise_error(Verse::Error::RecordNotFound)
      end
    end
  end

  # Permission: Annotator
  # ------------------------------------------------
  # Note Comments | index | create | update | delete
  # ------------------------------------------------
  # Assigned      |  yes  |  yes   |   own  |   own
  # Not Assigned  |   x   |   x    |    x   |    x
  context "as Annotator", as: :annotator do
    subject { described_class.new(current_auth_context) }

    before do
      annotator_member_id # Assign user to project
    end

    describe "with assigned project and assigned entries" do
      it "can index" do
        # Setup: create note feeds to test visibility
        project_owner_note_comment_id # assigned
        annotator_note_comment_id # assigned
        reviewer_first_note_comment_id # assigned
        reviewer_second_note_comment_id # assigned
        reviewer_third_note_comment_id # not assigned
        other_note_comment_id # not assigned

        result = subject.index({})

        expect(result.count).to eq 4
        expect(result.map(&:id)).to contain_exactly(
          project_owner_note_comment_id,
          annotator_note_comment_id,
          reviewer_first_note_comment_id,
          reviewer_second_note_comment_id
        )
      end

      it "can create" do
        create_data[:data][:relationships][:note_feed][:data][:id] = annotator_note_feed_id

        record = subject.create(deserialize(create_data))

        expect(record.note_feed_id).to eq annotator_note_feed_id
        expect(record.content_md).to eq "This is a created test note comment"
        expect(record.created_by_email).to eq "annotator@example.com"
      end

      it "can update own note feed comment" do
        update_data[:data][:id] = annotator_note_comment_id

        record = subject.update(deserialize(update_data))

        expect(record.note_feed_id).to eq annotator_note_feed_id
        expect(record.content_md).to eq "This is an updated test note comment"
        expect(record.created_by_email).to eq "annotator@example.com"
      end

      it "can delete own note feed comment" do
        subject.delete(annotator_note_comment_id)

        expect {
          subject.show(annotator_note_comment_id)
        }.to raise_error(Verse::Error::RecordNotFound)
      end

      it "cannot update others note feed comment" do
        update_data[:data][:id] = reviewer_first_note_comment_id

        expect {
          subject.update(deserialize(update_data))
        }.to raise_error(Verse::Error::RecordNotFound)
      end

      it "cannot delete others note feed comment" do
        expect {
          subject.delete(reviewer_first_note_comment_id)
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
          email: "annotator@example.com",
          invited_by_id: 1
        )
      end

      it "cannot index" do
        # Setup: create note feeds to test visibility
        project_owner_note_comment_id # assigned
        annotator_note_comment_id # assigned
        reviewer_first_note_comment_id # assigned
        reviewer_second_note_comment_id # assigned
        reviewer_third_note_comment_id # not assigned
        other_note_comment_id # not assigned

        # Ensure that the annotator is a member of the third project
        member = project_member_repo.find_by!({ account_id: annotator_account_id, project_id: second_project_id })
        expect(member.project_id).to eq second_project_id

        # Ensure that the annotator cannot see unassigned entries in the third project
        result = subject.index({})
        expect(result.count).to eq 4
        expect(result.map(&:id)).to_not include reviewer_third_note_comment_id, other_note_comment_id
      end

      it "cannot create" do
        create_data[:data][:relationships][:note_feed][:data][:id] = reviewer_third_note_feed_id

        # Note feed exists but annotator is not assigned to entry
        expect {
          subject.create(deserialize(create_data))
        }.to raise_error(
          Verse::Error::ValidationFailed,
          "note feed not found to create a comment"
        )
      end

      it "cannot update" do
        update_data[:data][:id] = project_owner_note_comment_id

        expect {
          subject.update(deserialize(update_data))
        }.to raise_error(Verse::Error::RecordNotFound)
      end

      it "cannot delete" do
        expect {
          subject.delete(project_owner_note_comment_id)
        }.to raise_error(Verse::Error::RecordNotFound)
      end
    end

    describe "with not assigned project" do
      it "cannot index" do
        # Setup: create note feeds to test visibility
        project_owner_note_comment_id # assigned
        annotator_note_comment_id # assigned
        reviewer_first_note_comment_id # assigned
        reviewer_second_note_comment_id # assigned
        reviewer_third_note_comment_id # not assigned
        other_note_comment_id # not assigned

        result = subject.index({})

        expect(result.count).to eq 4
        expect(result.map(&:id)).to_not include reviewer_third_note_comment_id, other_note_comment_id
      end

      it "cannot create" do
        create_data[:data][:relationships][:note_feed][:data][:id] = reviewer_third_note_feed_id

        expect {
          subject.create(deserialize(create_data))
        }.to raise_error(
          Verse::Error::ValidationFailed,
          "note feed not found to create a comment"
        )
      end

      it "cannot update" do
        update_data[:data][:id] = other_note_comment_id

        expect {
          subject.update(deserialize(update_data))
        }.to raise_error(Verse::Error::RecordNotFound)
      end

      it "cannot delete" do
        expect {
          subject.delete(other_note_comment_id)
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
      reviewer_member_id # Assign user to project
    end

    describe "with assigned project and assigned entries" do
      it "can index" do
        # Setup: create note comments to test visibility
        project_owner_note_comment_id # not assigned
        annotator_note_comment_id # not assigned
        reviewer_first_note_comment_id # not assigned
        reviewer_second_note_comment_id # not assigned
        reviewer_third_note_comment_id # assigned
        other_note_comment_id # not assigned

        result = subject.index({})

        # Can only see third note comment which is in their assigned entry
        expect(result.count).to eq 1
        expect(result.map(&:id)).to contain_exactly(reviewer_third_note_comment_id)
      end

      it "can create" do
        create_data[:data][:relationships][:note_feed][:data][:id] = reviewer_third_note_feed_id

        record = subject.create(deserialize(create_data))

        expect(record.note_feed_id).to eq reviewer_third_note_feed_id
        expect(record.content_md).to eq "This is a created test note comment"
        expect(record.created_by_email).to eq "reviewer@example.com"
      end

      it "can update" do
        update_data[:data][:id] = reviewer_third_note_comment_id

        record = subject.update(deserialize(update_data))

        expect(record.note_feed_id).to eq reviewer_third_note_feed_id
        expect(record.content_md).to eq "This is an updated test note comment"
        expect(record.created_by_email).to eq "reviewer@example.com"
      end

      it "can delete" do
        subject.delete(reviewer_third_note_comment_id)

        expect {
          subject.show(reviewer_third_note_comment_id)
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
          email: "reviewer@example.com",
          invited_by_id: 1
        )
      end

      it "cannot index" do
        # Setup: create note comments to test visibility
        project_owner_note_comment_id # not assigned
        annotator_note_comment_id # not assigned
        reviewer_first_note_comment_id # not assigned
        reviewer_second_note_comment_id # not assigned
        reviewer_third_note_comment_id # assigned
        other_note_comment_id # not assigned

        # Ensure that the reviewer is a member of the second project
        member = project_member_repo.find_by!({ account_id: reviewer_account_id, project_id: second_project_id })
        expect(member.project_id).to eq second_project_id

        # Ensure that the reviewer cannot see unassigned entries in the third project
        result = subject.index({})
        expect(result.count).to eq 1
        expect(result.first.id).to_not eq reviewer_first_note_comment_id
      end

      it "cannot create" do
        create_data[:data][:relationships][:note_feed][:data][:id] = other_note_feed_id

        # Note feed exists but annotator is not assigned to entry
        expect {
          subject.create(deserialize(create_data))
        }.to raise_error(
          Verse::Error::ValidationFailed,
          "note feed not found to create a comment"
        )
      end

      it "cannot update" do
        update_data[:data][:id] = project_owner_note_comment_id

        expect {
          subject.update(deserialize(update_data))
        }.to raise_error(Verse::Error::RecordNotFound)
      end

      it "cannot delete" do
        expect {
          subject.delete(project_owner_note_comment_id)
        }.to raise_error(Verse::Error::RecordNotFound)
      end
    end

    describe "with not assigned project" do
      it "cannot index" do
        # Setup: create note feeds to test visibility
        project_owner_note_comment_id # not assigned
        annotator_note_comment_id # not assigned
        reviewer_first_note_comment_id # not assigned
        reviewer_second_note_comment_id # not assigned
        reviewer_third_note_comment_id # assigned
        other_note_comment_id # not assigned

        result = subject.index({})

        expect(result.count).to eq 1
        expect(result.first.id).to_not include(
          project_owner_note_feed_id,
          annotator_note_feed_id,
          reviewer_first_note_feed_id,
          reviewer_second_note_feed_id,
          other_note_feed_id
        )
      end

      it "cannot create" do
        create_data[:data][:relationships][:note_feed][:data][:id] = other_note_feed_id

        expect {
          subject.create(deserialize(create_data))
        }.to raise_error(
          Verse::Error::ValidationFailed,
          "note feed not found to create a comment"
        )
      end

      it "cannot update" do
        update_data[:data][:id] = other_note_comment_id

        expect {
          subject.update(deserialize(update_data))
        }.to raise_error(Verse::Error::RecordNotFound)
      end

      it "cannot delete" do
        expect {
          subject.delete(other_note_comment_id)
        }.to raise_error(Verse::Error::RecordNotFound)
      end
    end
  end
end
