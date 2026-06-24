# frozen_string_literal: true

require "spec_helper"

RSpec.describe Entry::Service, database: true do
  let(:auth_context) { Verse::Auth::Context[:system] }

  subject { described_class.new(auth_context) }

  let(:repo) { Entry::Repository.new(auth_context) }
  let(:project_repo) { Project::Repository.new(auth_context) }
  let(:dataset_repo) { Dataset::Repository.new(auth_context) }

  let!(:project_id) do
    project_repo.create(
      name: "Test Project",
      description: "A test project",
      created_by_email: "user@example.com",
      organization_id: 1,
    )
  end

  let!(:dataset_id) do
    dataset_repo.create(
      modality: "video",
      labels: ["cat", "dog"],
      labeling_configuration: { "width" => 100, "height" => 100 },
      workflow_configuration: {},
      project_id:
    )
  end

  let(:attributes) do
    {
      priority: 1,
      resource: "http://example.com/video.mp4",
      name: "video.mp4",
      wf_step: "start",
      status: "pending",
      assigned_to_id: 1,
      dataset_id:
    }
  end

  let(:entry) do
    record = deserialize(
      {
        data: {
          type: "dataset:entries",
          attributes:,
          relationships: {
            dataset: {
              data: {
                type: "dataset:datasets",
                id: dataset_id
              }
            }
          }
        }
      }
    )
    subject.create(record)
  end

  describe "#create" do
    context "when job_id is not provided" do
      before do
        body = {
          data: {
            resource: "http://example.com/video.mp4",
            name: "video.mp4",
            sizes: ["240p", "360p", "480p", "720p", "1080p", "1440p", "2160p"],
            generate_frames: false,
            generate_thumbnail: true,
            generate_frame_format: "avif",
            generate_frame_framerate: 6,
            streaming_time_per_segment: 10
          }
        }.to_json

        stub_request(:post, "https://idah.example.com//api/v1/media/videos/process").
          with(
            headers: {
              "Accept" => "*/*",
              "Accept-Encoding" => "gzip;q=1.0,deflate;q=0.6,identity;q=0.3",
              "Host" => "idah.example.com",
              "User-Agent" => "Ruby"
            }
          ).to_return(status: 200, body:, headers: {})

        allow(subject.entries).to receive(:after_commit).and_yield
      end

      it "creates an entry with status pending until job is completed" do
        entry_record = deserialize(
          {
            data: {
              type: "dataset:entries",
              attributes: {
                name: "video.mp4",
                resource: "http://example.com/video.mp4",
                status: "pending"
              },
              relationships: {
                dataset: {
                  data: {
                    type: "dataset:datasets",
                    id: dataset_id
                  }
                }
              }
            }
          }
        )
        result = subject.create(entry_record)
        expect(result.status).to eq("pending")
        expect(result.project_id).to eq(project_id)
        expect(result.dataset_id).to eq(dataset_id)
      end
    end

    context "when job_id is provided" do
      let(:job_id) { UUIDv7.generate }
      let(:entry_record) do
        deserialize(
          {
            data: {
              type: "dataset:entries",
              attributes: attributes.merge(job_id: job_id),
              relationships: {
                dataset: {
                  data: {
                    type: "dataset:datasets",
                    id: dataset_id
                  }
                }
              }
            }
          }
        )
      end

      context "when the job is done" do
        before do
          body = {
            data: {
              id: job_id,
              type: "media:jobs",
              attributes: {
                status: "completed"
              }
            }
          }.to_json

          stub_request(:get, "https://idah.example.com//api/v1/media/jobs/123").
            with(
              headers: {
                "Accept" => "*/*",
                "Accept-Encoding" => "gzip;q=1.0,deflate;q=0.6,identity;q=0.3",
                "Host" => "idah.example.com",
                "User-Agent" => "Ruby"
              }
            ).to_return(status: 200, body:, headers: {})

          allow(subject.entries).to receive(:after_commit).and_yield
        end
      end

      context "when the job is not done" do
        before do
          stub_request(:get, "http://localhost:3001/jobs/#{job_id}").
            to_return(status: 200,
                      body: {
                        data: {
                          id: job_id,
                          type: "media:jobs",
                          attributes: { status: "running" }
                        }
                      }.to_json,
                      headers: { "Content-Type" => "application/json" })
        end

        it "creates an entry with status pending" do
          result = subject.create(entry_record)
          expect(result.status).to eq("pending")
        end
      end
    end
  end

  describe "#complete_entry_processing" do
    let(:job_id) { UUIDv7.generate }

    before do
      repo.create({ project_id:, dataset_id:, job_id:, status: "processing", wf_step: "start" })
    end

    it "advances wf_step from start to annotate via workflow submit" do
      subject.complete_entry_processing(job_id)

      entries = repo.index({ job_id: job_id })
      expect(entries.map(&:wf_step)).to all(eq("annotate"))
    end

    it "sets status to pending when no one is assigned" do
      subject.complete_entry_processing(job_id)

      entries = repo.index({ job_id: job_id })
      expect(entries.map(&:status)).to all(eq("pending"))
    end
  end

  describe "#mark_entries_status_as" do
    let(:job_id) { UUIDv7.generate }
    let(:other_job_id) { UUIDv7.generate }

    before do
      repo.create({ project_id:, dataset_id:, job_id:, status: "processing" })
      repo.create({ project_id:, dataset_id:, job_id: other_job_id, status: "done" })
    end

    it "marks entries with the given job_id as pending" do
      subject.mark_entries_status_as(job_id, "pending")

      entries = repo.index({ job_id: job_id })
      expect(entries.map(&:status)).to all(eq("pending"))

      other_entry = repo.index({ job_id: other_job_id }).first
      expect(other_entry.status).to eq("done")
    end

    it "marks entries with the given job_id as errored" do
      subject.mark_entries_status_as(job_id, "errored")

      entries = repo.index({ job_id: job_id })
      expect(entries.map(&:status)).to all(eq("errored"))

      other_entry = repo.index({ job_id: other_job_id }).first
      expect(other_entry.status).to eq("done")
    end
  end

  describe "#index" do
    before do
      # Create first entry
      entry

      # Create second entry
      record = deserialize(
        {
          data: {
            type: "dataset:entries",
            attributes: attributes.merge(priority: 2, resource: "http://example.com/video2.mp4"),
            relationships: {
              dataset: {
                data: {
                  type: "dataset:datasets",
                  id: dataset_id
                }
              }
            }
          }
        }
      )
      subject.create(record)
    end

    it "returns all entries when no filter is provided" do
      result = subject.index

      expect(result.count).to eq(2)
    end

    it "filters entries by dataset_id" do
      result = subject.index({ dataset_id: dataset_id })
      expect(result.all? { |e| e.dataset_id == dataset_id }).to be true
    end
  end

  describe "#show" do
    it "shows an entry" do
      found_entry = subject.show(entry.id)
      expect(found_entry.id).to eq(entry.id)
    end

    it "raises error when entry not found" do
      expect { subject.show(UUIDv7.generate) }.to raise_error(Verse::Error::NotFound)
    end
  end

  describe "#update" do
    it "updates an entry" do
      record = deserialize(
        {
          data: {
            type: "entries",
            id: entry.id,
            attributes: {
              status: "in_progress",
            }
          }
        }
      )

      subject.update(record)

      updated_entry = repo.find!(entry.id)
      expect(updated_entry.status).to eq("in_progress")
    end
  end

  describe "#assign_member" do
    it "assigns a member to an entry and sets status to in_progress" do
      subject.assign_member(entry.id, 2)

      updated_entry = repo.find!(entry.id)
      expect(updated_entry.assigned_to_id).to eq(2)
      expect(updated_entry.status).to eq("in_progress")
    end
  end

  describe "#unassign_member" do
    before do
      repo.update!(entry.id, { assigned_to_id: 2, status: "in_progress" })
    end

    it "clears the assigned member and sets status to pending" do
      subject.unassign_member(entry.id)

      updated_entry = repo.find!(entry.id)
      expect(updated_entry.assigned_to_id).to be_nil
      expect(updated_entry.status).to eq("pending")
    end
  end

  describe "assigned_to relation (project-scoped composite key)" do
    let(:project_member_repo) { ProjectMember::Repository.new(auth_context) }

    it "resolves assigned_to to the membership in the entry's own project" do
      project_member_repo.create(
        project_id:,
        account_id: 42,
        email: "member@example.com",
        role: "annotator",
        invited_by_id: 1
      )

      subject.assign_member(entry.id, 42)

      result = repo.find!(entry.id, included: [:assigned_to])
      expect(result.assigned_to).not_to be_nil
      expect(result.assigned_to.email).to eq("member@example.com")
    end

    it "does not resolve assigned_to to a membership in a different project" do
      other_project_id = project_repo.create(
        name: "Other Project",
        description: "Another project",
        created_by_email: "other@example.com",
        organization_id: 1
      )
      # Account 99 is a member of ANOTHER project only, not the entry's project.
      project_member_repo.create(
        project_id: other_project_id,
        account_id: 99,
        email: "stray@example.com",
        role: "annotator",
        invited_by_id: 1
      )

      subject.assign_member(entry.id, 99)

      result = repo.find!(entry.id, included: [:assigned_to])
      expect(result.assigned_to).to be_nil
    end
  end

  describe "#delete" do
    it "deletes an entry" do
      subject.delete(entry.id)
      expect { repo.find!(entry.id) }.to raise_error(Verse::Error::NotFound)
    end

    it "cannot delete an entry with in_progress or completed status" do
      updating_record = deserialize(
        {
          data: {
            type: "entries",
            id: entry.id,
            attributes: {
              status: "in_progress",
            }
          }
        }
      )
      subject.update(updating_record)

      expect {
        subject.delete(entry.id)
      }.to raise_error(
        Verse::Error::Unauthorized,
        "Unable to delete in progress or completed entry"
      )

      updating_record = deserialize(
        {
          data: {
            type: "entries",
            id: entry.id,
            attributes: {
              status: "completed",
            }
          }
        }
      )
      subject.update(updating_record)

      expect {
        subject.delete(entry.id)
      }.to raise_error(
        Verse::Error::Unauthorized,
        "Unable to delete in progress or completed entry"
      )
    end
  end

  describe "#submit" do
    let!(:test_entry) do
      repo.create(
        {
          project_id:,
          dataset_id:,
          resource: "test-video.mp4",
          status: "pending",
          wf_step: "start"
        }
      )
    end

    context "when transitioning from annotate to review" do
      before do
        repo.update!(test_entry, { wf_step: "annotate" })
        # Mock random to always trigger sampling
        allow_any_instance_of(Workflow::SimpleReviewAnnotationWorkflow).to receive(:rand).and_return(0.5)
      end

      it "transitions to review when should_sample? returns true" do
        # Set sample_rate to 1 to ensure sampling
        dataset_repo.update!(dataset_id, { workflow_configuration: { "sample_rate" => 1 } })

        result = subject.submit(test_entry)

        expect(result.wf_step).to eq("review")
        expect(result.status).to eq("pending")
      end
    end

    context "when transitioning from annotate to done" do
      before do
        repo.update!(test_entry, { wf_step: "annotate" })
        # Mock random to not trigger sampling
        allow_any_instance_of(Workflow::SimpleReviewAnnotationWorkflow).to receive(:rand).and_return(0.5)
      end

      it "transitions to done when should_sample? returns false" do
        # Set sample_rate to 0 to ensure no sampling
        dataset_repo.update!(dataset_id, { workflow_configuration: { "sample_rate" => 0 } })

        result = subject.submit(test_entry)

        expect(result.wf_step).to eq("done")
        expect(result.status).to eq("completed")
      end
    end

    context "when transitioning from review to done" do
      before do
        repo.update!(test_entry, { wf_step: "review" })
      end

      it "transitions to done when approved is true" do
        result = subject.submit(test_entry, approved: true)

        expect(result.wf_step).to eq("done")
        expect(result.status).to eq("completed")
      end
    end

    context "when transitioning from review to annotate" do
      before do
        repo.update!(test_entry, { wf_step: "review", submitted_by_id: 123 })
      end

      it "transitions back to annotate when approved is false" do
        result = subject.submit(test_entry, approved: false)

        expect(result.wf_step).to eq("annotate")
        expect(result.status).to eq("in_progress")
      end
    end

    context "email snapshots stay paired with their ids" do
      # Use a context carrying a known actor so we can assert the email snapshot
      let(:auth_context) do
        Verse::Auth::Context.new(["*.*.*"], metadata: { id: 999, email: "actor@example.com", role: "admin" })
      end

      it "records submitted_by_email alongside submitted_by_id when annotating" do
        repo.update!(test_entry, { wf_step: "annotate" })
        # No sampling -> annotate transitions straight to done
        dataset_repo.update!(dataset_id, { workflow_configuration: { "sample_rate" => 0 } })

        result = subject.submit(test_entry)

        expect(result.submitted_by_id).to eq(999)
        expect(result.submitted_by_email).to eq("actor@example.com")
      end

      it "carries submitted_by_email into assigned_to_email when a review sends it back to annotate" do
        repo.update!(
          test_entry,
          {
            wf_step: "review",
            submitted_by_id: 42,
            submitted_by_email: "annotator@example.com"
          }
        )

        result = subject.submit(test_entry, approved: false)

        expect(result.wf_step).to eq("annotate")
        # Reviewer (acting account) recorded with its email
        expect(result.reviewed_by_id).to eq(999)
        expect(result.reviewed_by_email).to eq("actor@example.com")
        # Re-assigned to the original annotator, email snapshot preserved
        expect(result.assigned_to_id).to eq(42)
        expect(result.assigned_to_email).to eq("annotator@example.com")
      end
    end

    context "when entry does not exist" do
      it "raises a not found error" do
        expect { subject.submit(UUIDv7.generate) }
          .to raise_error(Verse::Error::NotFound)
      end
    end

    context "when review step is missing approved option" do
      before do
        repo.update!(test_entry, { wf_step: "review" })
      end

      it "raises a validation error" do
        expect { subject.submit(test_entry) }
          .to raise_error(Verse::Error::ValidationFailed, /Missing required option :approved/)
      end
    end
  end

  describe "#error" do
    let!(:test_entry) do
      repo.create(
        {
          project_id:,
          dataset_id:,
          resource: "test-video.mp4",
          status: "in_progress",
          wf_step: "annotate"
        }
      )
    end

    context "when transitioning from annotate to error" do
      it "updates the entry to error state" do
        result = subject.error(test_entry)

        expect(result.wf_step).to eq("error")
        expect(result.status).to eq("errored")
        expect(result.id).to eq(test_entry)
      end
    end

    context "when transitioning from review to error" do
      before do
        repo.update!(test_entry, { wf_step: "review" })
      end

      it "updates the entry to error state" do
        result = subject.error(test_entry)

        expect(result.wf_step).to eq("error")
        expect(result.status).to eq("errored")
      end
    end

    context "when passing optional parameters" do
      it "accepts additional options" do
        result = subject.error(test_entry, message: "Processing failed")

        expect(result.wf_step).to eq("error")
        expect(result.status).to eq("errored")
      end
    end

    context "when entry does not exist" do
      it "raises a not found error" do
        expect { subject.error(UUIDv7.generate) }
          .to raise_error(Verse::Error::NotFound)
      end
    end
  end

  describe "#unassign_account_entries" do
    let(:account_id) { 123 }
    let(:another_account_id) { 456 }

    before do
      # Create another dataset and project for testing multiple datasets
      @another_project_id = project_repo.create(
        name: "Another Project",
        description: "Another test project",
        created_by_email: "user2@example.com",
        organization_id: 1
      )

      @another_dataset_id = dataset_repo.create(
        modality: "image",
        labels: ["cat", "dog"],
        labeling_configuration: { "width" => 200, "height" => 200 },
        workflow_configuration: {},
        project_id: @another_project_id
      )

      # Create entries assigned to account 123 in project 1
      @entry1_id = repo.create(
        project_id:,
        dataset_id:,
        resource: "http://example.com/video1.mp4",
        status: "pending",
        wf_step: "start",
        assigned_to_id: account_id
      )

      @entry2_id = repo.create(
        project_id:,
        dataset_id:,
        resource: "http://example.com/video2.mp4",
        status: "in_progress",
        wf_step: "annotate",
        assigned_to_id: account_id
      )

      # Create entry assigned to account 123 in another project
      @entry3_id = repo.create(
        project_id: @another_project_id,
        dataset_id: @another_dataset_id,
        resource: "http://example.com/image1.jpg",
        status: "pending",
        wf_step: "start",
        assigned_to_id: account_id
      )

      # Create entry assigned to different account in project 1
      @other_account_entry_id = repo.create(
        project_id:,
        dataset_id:,
        resource: "http://example.com/video3.mp4",
        status: "pending",
        wf_step: "start",
        assigned_to_id: another_account_id
      )

      # Create entry with no assignment in project 1
      @unassigned_entry_id = repo.create(
        project_id:,
        dataset_id:,
        resource: "http://example.com/video4.mp4",
        status: "pending",
        wf_step: "start",
        assigned_to_id: nil
      )
    end

    it "unassigns entries for the given account_id within the specified project_id only" do
      subject.unassign_account_entries(account_id, project_id)

      # Entries for the specified account in the specified project should be unassigned
      entry1 = repo.find!(@entry1_id)
      entry2 = repo.find!(@entry2_id)

      expect(entry1.assigned_to_id).to be_nil
      expect(entry2.assigned_to_id).to be_nil

      # Entry for same account in different project should remain assigned
      entry3 = repo.find!(@entry3_id)
      expect(entry3.assigned_to_id).to eq(account_id)

      # Entries for other accounts should remain assigned
      other_entry = repo.find!(@other_account_entry_id)
      expect(other_entry.assigned_to_id).to eq(another_account_id)

      # Already unassigned entries should remain unassigned
      unassigned_entry = repo.find!(@unassigned_entry_id)
      expect(unassigned_entry.assigned_to_id).to be_nil
    end

    it "handles accounts with no entries in the specified project" do
      expect { subject.unassign_account_entries(99_999, project_id) }.not_to raise_error
    end

    it "unassigns entries from multiple datasets within the same project" do
      # Create another dataset in the same project
      another_dataset_in_same_project = dataset_repo.create(
        modality: "image",
        labels: ["bird", "fish"],
        labeling_configuration: { "width" => 300, "height" => 300 },
        workflow_configuration: {},
        project_id: project_id
      )

      entry4_id = repo.create(
        project_id:,
        dataset_id: another_dataset_in_same_project,
        resource: "http://example.com/image2.jpg",
        status: "pending",
        wf_step: "start",
        assigned_to_id: account_id
      )

      subject.unassign_account_entries(account_id, project_id)

      # Verify all entries from different datasets in same project are unassigned
      entry1 = repo.find!(@entry1_id)
      entry2 = repo.find!(@entry2_id)
      entry4 = repo.find!(entry4_id)

      expect(entry1.assigned_to_id).to be_nil
      expect(entry2.assigned_to_id).to be_nil
      expect(entry4.assigned_to_id).to be_nil
    end

    it "only affects entries in the specified project" do
      subject.unassign_account_entries(account_id, project_id)

      # Count entries that were changed
      all_entries = repo.index({})
      project1_entries = all_entries.select { |e| e.project_id == project_id }
      project2_entries = all_entries.select { |e| e.project_id == @another_project_id }

      # In project 1: should have 3 unassigned entries (2 from account_id + 1 originally unassigned)
      project1_unassigned = project1_entries.select { |e| e.assigned_to_id.nil? }
      expect(project1_unassigned.count).to eq(3)

      # In project 2: entry should still be assigned to account_id
      project2_assigned = project2_entries.select { |e| e.assigned_to_id == account_id }
      expect(project2_assigned.count).to eq(1)
    end
  end

  describe "#duplicate_entries" do
    let(:new_dataset_id) do
      dataset_repo.create(
        modality: "video",
        labels: ["cat", "dog"],
        labeling_configuration: { "width" => 100, "height" => 100 },
        workflow_configuration: {},
        project_id: project_id
      )
    end

    let!(:entry_ready) do
      repo.create(
        project_id: project_id,
        dataset_id: dataset_id,
        resource: "http://example.com/ready.mp4",
        status: "ready",
        wf_step: "start"
      )
    end

    let!(:entry_pending) do
      repo.create(
        project_id: project_id,
        dataset_id: dataset_id,
        resource: "http://example.com/pending.mp4",
        status: "pending",
        wf_step: "start"
      )
    end

    it "duplicates ready entries without emitting events" do
      allow(subject.send(:entries)).to receive(:no_event).and_call_original

      subject.duplicate_entries(new_dataset_id, duping_dataset_id: dataset_id, entry_ids: [entry_ready])

      expect(subject.send(:entries)).to have_received(:no_event)
      duplicated_entries = repo.index({ dataset_id: new_dataset_id })
      expect(duplicated_entries.count).to eq(1)
      expect(duplicated_entries.first.status).to eq("ready")
      expect(duplicated_entries.first.resource).to eq("http://example.com/ready.mp4")
    end

    it "duplicates pending entries by emitting events" do
      allow(subject.send(:entries)).to receive(:no_event).and_call_original

      subject.duplicate_entries(new_dataset_id, duping_dataset_id: dataset_id, entry_ids: [entry_pending])

      expect(subject.send(:entries)).not_to have_received(:no_event)
      duplicated_entries = repo.index({ dataset_id: new_dataset_id })
      expect(duplicated_entries.count).to eq(1)
      expect(duplicated_entries.first.status).to eq("pending")
      expect(duplicated_entries.first.resource).to eq("http://example.com/pending.mp4")
    end

    it "duplicates all entries when entry_ids is nil" do
      original_count = repo.index({ dataset_id: dataset_id }).count

      subject.duplicate_entries(new_dataset_id, duping_dataset_id: dataset_id)

      duplicated_entries = repo.index({ dataset_id: new_dataset_id })
      expect(duplicated_entries.count).to eq(original_count)
    end

    context "with annotations" do
      let(:annotation_repo) { Annotation::Repository.new(auth_context) }

      before do
        annotation_repo.create(
          project_id: project_id,
          dataset_id: dataset_id,
          entry_id: entry_ready,
          dimensions: { x: 10, y: 20, width: 30, height: 40 },
          annotation: { label: "cat" },
          created_by_email: "user@example.com"
        )
      end

      it "duplicates annotations when with_annotations is true" do
        subject.duplicate_entries(
          new_dataset_id,
          duping_dataset_id: dataset_id,
          entry_ids: [entry_ready],
          with_annotations: true
        )

        duplicated_entries = repo.index({ dataset_id: new_dataset_id })
        expect(duplicated_entries.count).to eq(1)

        duplicated_annotations = annotation_repo.index({ entry_id: duplicated_entries.first.id })
        expect(duplicated_annotations.count).to eq(1)
        expect(duplicated_annotations.first.created_by_email).to eq("user@example.com")
      end

      it "does not duplicate annotations when with_annotations is false" do
        subject.duplicate_entries(
          new_dataset_id,
          duping_dataset_id: dataset_id,
          entry_ids: [entry_ready],
          with_annotations: false
        )

        duplicated_entries = repo.index({ dataset_id: new_dataset_id })
        expect(duplicated_entries.count).to eq(1)

        duplicated_annotations = annotation_repo.index({ entry_id: duplicated_entries.first.id })
        expect(duplicated_annotations.count).to eq(0)
      end
    end
  end
end
