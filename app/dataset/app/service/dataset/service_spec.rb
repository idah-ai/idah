# frozen_string_literal: true

require "spec_helper"

RSpec.describe Dataset::Service, database: true do
  let(:auth_context){ Verse::Auth::Context.new }

  subject { described_class.new(auth_context) }

  let(:repo) { Dataset::Repository.new(auth_context) }
  let(:project_repo) { Project::Repository.new(auth_context) }

  let!(:project_id) do
    project_repo.create(
      name: "Test Project",
      description: "A test project",
      created_by_email: "user@example.com",
      organization_id: 1
    )
  end

  let(:attributes) do
    {
      modality: "image_labeling",
      labels: ["cat", "dog"],
      labeling_configuration: {},
      workflow_configuration: {},
      project_id: project_id
    }
  end

  describe "#index" do
    it "returns all datasets" do
      dataset1_id = repo.create(attributes)
      dataset2_id = repo.create(attributes.merge(labels: ["bird", "fish"]))

      result = subject.index

      expect(result.count).to eq(2)
      expect(result.map(&:id)).to include(dataset1_id, dataset2_id)
    end

    it "returns datasets with pagination" do
      repo.create(attributes)
      repo.create(attributes.merge(labels: ["bird", "fish"]))

      result = subject.index({}, page: 1, items_per_page: 1)

      expect(result.count).to eq(1)
    end

    it "returns datasets with filter" do
      dataset1_id = repo.create(attributes)
      repo.create(attributes.merge(labels: ["bird", "fish"]))

      result = subject.index({ id: dataset1_id })

      expect(result.count).to eq(1)
      expect(result.first.id).to eq(dataset1_id)
    end
  end

  describe "#create" do
    it "creates a new dataset" do
      record = deserialize(
        {
          data: {
            type: "datasets",
            attributes: attributes,
            relationships: {
              project: {
                data: {
                  type: "projects",
                  id: project_id
                }
              }
            }
          }
        }
      )
      dataset = subject.create(record)
      expect(dataset.modality).to eq("image_labeling")
      expect(dataset.labels).to eq(["cat", "dog"])
    end
  end

  describe "#show" do
    it "shows a dataset" do
      dataset_id = repo.create(attributes)

      found_dataset = subject.show(dataset_id)
      expect(found_dataset.id).to eq(dataset_id)
    end
  end

  describe "#update" do
    it "updates a dataset" do
      dataset_id = repo.create(attributes)

      record = deserialize(
        {
          data: {
            type: "datasets",
            id: dataset_id,
            attributes: {
              labels: ["cat", "dog", "bird"],
            }
          }
        }
      )

      subject.update(record)

      updated_dataset = repo.find!(dataset_id)
      expect(updated_dataset.labels).to eq(["cat", "dog", "bird"])
    end
  end

  describe "#delete" do
    it "deletes a dataset" do
      dataset_id = repo.create(attributes)
      subject.delete(dataset_id)
      expect { repo.find!(dataset_id) }.to raise_error(Verse::Error::NotFound)
    end

    it "cannot delete a dataset with in_progress or completed status" do
      dataset_id = repo.create(attributes)
      updating_record = deserialize(
        {
          data: {
            type: "datasets",
            id: dataset_id,
            attributes: {
              status: "in_progress"
            }
          }
        }
      )
      subject.update(updating_record)

      expect {
        subject.delete(dataset_id)
      }.to raise_error(
        Verse::Error::Unauthorized,
        "Unable to delete in progress or completed dataset"
      )

      updating_record = deserialize(
        {
          data: {
            type: "datasets",
            id: dataset_id,
            attributes: {
              status: "completed"
            }
          }
        }
      )
      subject.update(updating_record)

      expect {
        subject.delete(dataset_id)
      }.to raise_error(
        Verse::Error::Unauthorized,
        "Unable to delete in progress or completed dataset"
      )
    end
  end

  describe "#notify_dataset_completed" do
    let(:project_member_repo) { ProjectMember::Repository.new(auth_context) }
    let(:dataset_id) { repo.create(attributes.merge(name: "Test Dataset")) }

    before do
      # Create project owner member
      project_member_repo.create(
        project_id: project_id,
        account_id: 123,
        invited_by_id: 1,
        email: "owner@example.com",
        name: "Project Owner",
        role: "project_owner"
      )

      # Mock the notification service
      allow(::Service::Notification).to receive(:email)
    end

    it "sends notification to project owners when dataset is completed" do
      subject.notify_dataset_completed(dataset_id)

      expect(::Service::Notification).to have_received(:email).with(
        hash_including(
          to: "owner@example.com",
          title: "Dataset has been Completed",
          category: "dataset_completed",
          recipient_id: 123,
          dataset_name: "Test Dataset",
          project_name: "Test Project",
          recipient_name: "Project Owner"
        )
      )
    end

    it "sends notification to all project owners" do
      # Create another project owner
      project_member_repo.create(
        project_id: project_id,
        account_id: 456,
        email: "owner2@example.com",
        name: "Project Owner 2",
        role: "project_owner",
        invited_by_id: 1
      )

      subject.notify_dataset_completed(dataset_id)

      expect(::Service::Notification).to have_received(:email).exactly(2).times
    end

    it "does not send notification to non-owner members" do
      # Create a non-owner member
      project_member_repo.create(
        project_id: project_id,
        account_id: 789,
        email: "member@example.com",
        name: "Regular Member",
        role: "project_member",
        invited_by_id: 1
      )

      subject.notify_dataset_completed(dataset_id)

      # Should only send to the one owner, not the regular member
      expect(::Service::Notification).to have_received(:email).once
    end
  end

  describe "#duplicate" do
    let(:entry_repo) { Entry::Repository.new(auth_context) }
    let(:annotation_repo) { Annotation::Repository.new(auth_context) }
    let(:source_dataset_id) { repo.create(attributes.merge(name: "Source Dataset")) }
    
    let!(:entry1_id) do
      entry_repo.create(
        dataset_id: source_dataset_id,
        project_id: project_id,
        status: "ready",
        wf_step: "completed"
      )
    end
    
    let!(:entry2_id) do
      entry_repo.create(
        dataset_id: source_dataset_id,
        project_id: project_id,
        status: "pending",
        wf_step: "start"
      )
    end

    before do
      # Mock authorization
      allow(subject).to receive(:authorize_creation)
      # Mock UUIDv7 generation with valid UUIDs
      allow(UUIDv7).to receive(:generate).and_return(
        "019cdcdd-0000-7000-8000-000000000001",
        "019cdcdd-0000-7000-8000-000000000002", 
        "019cdcdd-0000-7000-8000-000000000003"
      )
    end

    context "when duplicating with valid entry IDs" do
      it "creates a new dataset with duplicated name" do
        result = subject.duplicate(source_dataset_id, [entry1_id, entry2_id])

        expect(result.name).to eq("Source Dataset - duplicated")
        expect(result.status).to eq("pending")
        # Note: The implementation creates entries, so these counts reflect the actual entries created
        expect(result.id).to eq("019cdcdd-0000-7000-8000-000000000001")
      end

      it "calls authorize_creation with correct project_id" do
        subject.duplicate(source_dataset_id, [entry1_id])

        expect(subject).to have_received(:authorize_creation).with(project_id)
      end

      it "duplicates entries and handles different statuses correctly" do
        # Mock the entries and annotations repositories used by the service
        entries_service = instance_double(Entry::Repository)
        annotations_service = instance_double(Annotation::Repository)
        
        allow(subject).to receive(:entries).and_return(entries_service)
        allow(subject).to receive(:annotations).and_return(annotations_service)
        
        # Mock entry finds
        ready_entry = double(:entry, dataset_id: source_dataset_id, status: "ready", fields: { id: entry1_id })
        pending_entry = double(:entry, dataset_id: source_dataset_id, status: "pending", fields: { id: entry2_id })
        
        allow(entries_service).to receive(:find).with(entry1_id).and_return(ready_entry)
        allow(entries_service).to receive(:find).with(entry2_id).and_return(pending_entry)
        allow(entries_service).to receive(:create).and_return("new-entry-id")
        allow(entries_service).to receive(:no_event).and_yield

        subject.duplicate(source_dataset_id, [entry1_id, entry2_id])

        # Verify entry creation calls
        expect(entries_service).to have_received(:create).twice
        expect(entries_service).to have_received(:no_event).once # for ready entry
      end

      it "handles ready entries without triggering events" do
        entries_service = instance_double(Entry::Repository)
        allow(subject).to receive(:entries).and_return(entries_service)
        
        ready_entry = double(:entry, dataset_id: source_dataset_id, status: "ready", fields: { id: entry1_id })
        allow(entries_service).to receive(:find).with(entry1_id).and_return(ready_entry)
        allow(entries_service).to receive(:create).and_return("new-entry-id")
        allow(entries_service).to receive(:no_event).and_yield

        subject.duplicate(source_dataset_id, [entry1_id])

        expect(entries_service).to have_received(:no_event)
      end

      it "handles pending entries with events" do
        entries_service = instance_double(Entry::Repository)
        allow(subject).to receive(:entries).and_return(entries_service)
        
        pending_entry = double(:entry, dataset_id: source_dataset_id, status: "pending", fields: { id: entry2_id })
        allow(entries_service).to receive(:find).with(entry2_id).and_return(pending_entry)
        allow(entries_service).to receive(:create).and_return("new-entry-id")
        allow(entries_service).to receive(:no_event)

        subject.duplicate(source_dataset_id, [entry2_id])

        # Should not call no_event for pending entries
        expect(entries_service).not_to have_received(:no_event)
      end
    end

    context "when duplicating with annotations" do
      it "duplicates annotations when with_annotations is true" do
        entries_service = instance_double(Entry::Repository)
        annotations_service = instance_double(Annotation::Repository)
        
        allow(subject).to receive(:entries).and_return(entries_service)
        allow(subject).to receive(:annotations).and_return(annotations_service)
        
        # Mock entry find
        ready_entry = double(:entry, dataset_id: source_dataset_id, status: "ready", fields: { id: entry1_id })
        allow(entries_service).to receive(:find).with(entry1_id).and_return(ready_entry)
        allow(entries_service).to receive(:create).and_return("new-entry-id")
        allow(entries_service).to receive(:no_event).and_yield
        
        # Mock annotations
        allow(annotations_service).to receive(:index).and_return([
          double(:annotation, 
            fields: {
              id: "019cdcdd-0000-7000-8000-000000000010",
              entry_id: entry1_id,
              dataset_id: source_dataset_id,
              project_id: project_id
            }
          )
        ])
        allow(annotations_service).to receive(:create)

        subject.duplicate(source_dataset_id, [entry1_id], with_annotations: true)

        expect(annotations_service).to have_received(:index)
        expect(annotations_service).to have_received(:create)
      end

      it "does not duplicate annotations when with_annotations is false" do
        entries_service = instance_double(Entry::Repository)
        annotations_service = instance_double(Annotation::Repository)
        
        allow(subject).to receive(:entries).and_return(entries_service)
        allow(subject).to receive(:annotations).and_return(annotations_service)
        
        # Mock entry find
        ready_entry = double(:entry, dataset_id: source_dataset_id, status: "ready", fields: { id: entry1_id })
        allow(entries_service).to receive(:find).with(entry1_id).and_return(ready_entry)
        allow(entries_service).to receive(:create).and_return("new-entry-id")
        allow(entries_service).to receive(:no_event).and_yield
        
        allow(annotations_service).to receive(:index)
        allow(annotations_service).to receive(:create)

        subject.duplicate(source_dataset_id, [entry1_id], with_annotations: false)

        expect(annotations_service).not_to have_received(:index)
        expect(annotations_service).not_to have_received(:create)
      end
    end

    context "when entry IDs don't belong to source dataset" do
      let(:other_dataset_id) { repo.create(attributes.merge(name: "Other Dataset")) }
      let!(:other_entry_id) do
        entry_repo.create(
          dataset_id: other_dataset_id,
          project_id: project_id,
          status: "ready"
        )
      end

      it "skips entries that don't belong to the source dataset" do
        entries_service = instance_double(Entry::Repository)
        allow(subject).to receive(:entries).and_return(entries_service)
        
        # Mock entry finds - one belongs to source dataset, one doesn't
        valid_entry = double(:entry, dataset_id: source_dataset_id, status: "ready", fields: { id: entry1_id })
        invalid_entry = double(:entry, dataset_id: other_dataset_id, status: "ready", fields: { id: other_entry_id })
        
        allow(entries_service).to receive(:find).with(entry1_id).and_return(valid_entry)
        allow(entries_service).to receive(:find).with(other_entry_id).and_return(invalid_entry)
        allow(entries_service).to receive(:create).and_return("new-entry-id")
        allow(entries_service).to receive(:no_event).and_yield

        subject.duplicate(source_dataset_id, [entry1_id, other_entry_id])

        # Should only create one entry (entry1_id), not other_entry_id
        expect(entries_service).to have_received(:create).once
      end
    end

    context "when authorization fails" do
      before do
        allow(subject).to receive(:authorize_creation).and_raise(
          Verse::Error::Unauthorized, "You do not have permission"
        )
      end

      it "raises unauthorized error" do
        expect {
          subject.duplicate(source_dataset_id, [entry1_id])
        }.to raise_error(Verse::Error::Unauthorized, "You do not have permission")
      end
    end

    context "with empty entry IDs" do
      it "creates dataset but no entries" do
        allow(entry_repo).to receive(:create)

        result = subject.duplicate(source_dataset_id, [])

        expect(result.name).to eq("Source Dataset - duplicated")
        expect(entry_repo).not_to have_received(:create)
      end
    end
  end

  describe "#authorize_creation" do
    let(:scoped_query_service) { class_double("ScopedQuery::Service") }
    let(:projects_service) { instance_double(Project::Repository) }

    before do
      stub_const("ScopedQuery::Service", scoped_query_service)
      # Mock the projects repository used in the service
      allow(subject).to receive(:projects).and_return(projects_service)
    end

    context "when access is :as_org_owner" do
      before do
        allow(auth_context).to receive(:can?).with(:create, Dataset::Repository.resource).and_return(:as_org_owner)
        allow(auth_context).to receive(:custom_scopes).and_return({ org: ["123"] })
      end

      context "when project belongs to authorized organization" do
        before do
          # Mock project with organization_id that matches auth scope
          project_double = double(:project, organization_id: 123)
          allow(projects_service).to receive(:find!).with(project_id).and_return(project_double)
        end

        it "allows creation" do
          expect {
            subject.send(:authorize_creation, project_id)
          }.not_to raise_error
        end
      end

      context "when project belongs to unauthorized organization" do
        before do
          # Mock project with organization_id that doesn't match auth scope
          project_double = double(:project, organization_id: 456)
          allow(projects_service).to receive(:find!).with(project_id).and_return(project_double)
        end

        it "raises unauthorized error" do
          expect {
            subject.send(:authorize_creation, project_id)
          }.to raise_error(
            Verse::Error::Unauthorized,
            "You do not have permission to create dataset on this project"
          )
        end
      end

      context "when project is not found" do
        before do
          allow(projects_service).to receive(:find!).with(project_id).and_raise(
            Verse::Error::RecordNotFound
          )
        end

        it "raises record not found error" do
          expect {
            subject.send(:authorize_creation, project_id)
          }.to raise_error(Verse::Error::RecordNotFound)
        end
      end
    end

    context "when access is :as_user" do
      before do
        allow(auth_context).to receive(:can?).with(:create, Dataset::Repository.resource).and_return(:as_user)
        allow(auth_context).to receive(:metadata).and_return({ id: "user-123" })
      end

      context "when user has project owner access" do
        before do
          allow(scoped_query_service).to receive(:without_project_access?).with(
            "user-123", project_id, ["project_owner"]
          ).and_return(false)
        end

        it "allows creation" do
          expect {
            subject.send(:authorize_creation, project_id)
          }.not_to raise_error
        end
      end

      context "when user lacks project owner access" do
        before do
          allow(scoped_query_service).to receive(:without_project_access?).with(
            "user-123", project_id, ["project_owner"]
          ).and_return(true)
        end

        it "raises unauthorized error" do
          expect {
            subject.send(:authorize_creation, project_id)
          }.to raise_error(
            Verse::Error::Unauthorized,
            "You do not have permission to create dataset on this project"
          )
        end
      end
    end

    context "when access level is neither :as_org_owner nor :as_user" do
      before do
        allow(auth_context).to receive(:can?).with(:create, Dataset::Repository.resource).and_return(:some_other_access)
      end

      it "does not raise error (falls through)" do
        expect {
          subject.send(:authorize_creation, project_id)
        }.not_to raise_error
      end
    end
  end
end
