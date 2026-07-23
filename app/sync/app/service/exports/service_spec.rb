# frozen_string_literal: true

# frozen_string_literal:

RSpec.describe Exports::Service, database: true do
  let(:auth_context) { Verse::Auth::Context[:system] }
  let(:service) { described_class.new(auth_context) }
  let(:repo) { service.exports }

  let(:project_id) { "019c9428-50d4-7b1b-a8bb-68cd3a284cef" }
  let(:job_id) { "019bba87-650e-74e8-a68a-bc49bfff2527" }

  describe "#create" do
    let(:dataset_ids) { [1, 2, 3] }
    let(:exporter) { "MyExporter" }
    let(:account_id) { 1 }

    subject {
      auth_context.metadata[:id] = account_id
      described_class.new(auth_context)
    }

    before do
      # By default, always allow export class
      allow(Exports::Registry).to receive(:valid_export_class?).and_return(true)

      # By default, pass through all dataset IDs (no filtering)
      allow_any_instance_of(described_class).to receive(:filter_dataset_ids_by_rights)
        .and_call_original
    end

    context "with valid exporter class" do
      before do
        # Stub the filtering to return all dataset IDs for these basic tests
        allow_any_instance_of(described_class).to receive(:filter_dataset_ids_by_rights)
          .with(project_id, dataset_ids).and_return(dataset_ids)
      end

      it "creates an export and a job" do
        export = subject.create(project_id, dataset_ids, exporter)

        expect(export).not_to be_nil
        expect(export.job_id).not_to be_nil
        expect(export.project_id).to eq(project_id)
        expect(export.created_by_id).to eq(account_id)

        job = Jobs::Service.new(auth_context).show(export.job_id)

        expect(job.job_class).to eq "Exports::Job"
        expect(job.arguments).to include(
          {
            dataset_ids:,
            exporter:,
            options: {}
          }
        )
        expect(job.arguments).to have_key(:export_id)
      end

      it "creates records within a transaction" do
        # The transaction is called on the repo's table's db, not directly on the repo
        expect_any_instance_of(Sequel::Postgres::Database).to receive(:transaction).at_least(:once).and_call_original

        export = subject.create(project_id, dataset_ids, exporter)
        expect(export).not_to be_nil
      end

      it "stores the created_by_id from auth context" do
        export = subject.create(project_id, dataset_ids, exporter)

        expect(export.created_by_id).to eq(account_id)
      end

      it "validates the exporter class before creating records" do
        expect(Exports::Registry).to receive(:valid_export_class?).with(exporter).and_return(true)

        subject.create(project_id, dataset_ids, exporter)
      end
    end

    context "with invalid exporter class" do
      it "raises an error" do
        allow(Exports::Registry).to receive(:valid_export_class?).with("bad_class").and_return(false)

        expect {
          subject.create(project_id, dataset_ids, "bad_class")
        }.to raise_error(Verse::Error::Authorization, "invalid export format: `bad_class`")
      end

      it "does not create an export or job" do
        allow(Exports::Registry).to receive(:valid_export_class?).with("bad_class").and_return(false)

        initial_export_count = service.index.to_a.size
        initial_job_count = Jobs::Service.new(auth_context).index.to_a.size

        expect {
          subject.create(project_id, dataset_ids, "bad_class")
        }.to raise_error(Verse::Error::Authorization)

        expect(service.index.to_a.size).to eq(initial_export_count)
        expect(Jobs::Service.new(auth_context).index.to_a.size).to eq(initial_job_count)
      end
    end

    context "dataset filtering by rights" do
      context "when user has access to all  datasets" do
        before do
          allow_any_instance_of(described_class).to receive(:filter_dataset_ids_by_rights)
            .with(project_id, dataset_ids).and_return(dataset_ids)
        end

        it "creates export with all dataset IDs" do
          export = subject.create(project_id, dataset_ids, exporter)

          job = Jobs::Service.new(auth_context).show(export.job_id)
          expect(job.arguments[:dataset_ids]).to eq(dataset_ids)
        end
      end

      context "when user has access to only some datasets" do
        let(:filtered_ids) { [1, 2] }

        before do
          allow_any_instance_of(described_class).to receive(:filter_dataset_ids_by_rights)
            .with(project_id, dataset_ids).and_return(filtered_ids)
        end

        it "creates export with only accessible dataset IDs" do
          export = subject.create(project_id, dataset_ids, exporter)

          job = Jobs::Service.new(auth_context).show(export.job_id)
          expect(job.arguments[:dataset_ids]).to eq(filtered_ids)
        end
      end

      context "when user has no access to any datasets" do
        before do
          allow_any_instance_of(described_class).to receive(:filter_dataset_ids_by_rights)
            .with(project_id, dataset_ids).and_return([])
        end

        it "raises authorization error" do
          expect {
            subject.create(project_id, dataset_ids, exporter)
          }.to raise_error(Verse::Error::Authorization, "You do not have access to any of the datasets provided")
        end

        it "does not create an export or job when no datasets are accessible" do
          initial_export_count = service.index.to_a.size
          initial_job_count = Jobs::Service.new(auth_context).index.to_a.size

          expect {
            subject.create(project_id, dataset_ids, exporter)
          }.to raise_error(Verse::Error::Authorization)

          expect(service.index.to_a.size).to eq(initial_export_count)
          expect(Jobs::Service.new(auth_context).index.to_a.size).to eq(initial_job_count)
        end
      end
    end

    context "authorization flow" do
      it "calls filter_dataset_ids_by_rights with correct parameters" do
        allow_any_instance_of(described_class).to receive(:filter_dataset_ids_by_rights)
          .with(project_id, dataset_ids).and_return(dataset_ids)

        expect_any_instance_of(described_class).to receive(:filter_dataset_ids_by_rights)
          .with(project_id, dataset_ids)

        subject.create(project_id, dataset_ids, exporter)
      end

      it "validates exporter class before checking dataset rights" do
        call_order = []

        allow(Exports::Registry).to receive(:valid_export_class?) do |_arg|
          call_order << :validate_exporter
          true
        end

        allow_any_instance_of(described_class).to receive(:filter_dataset_ids_by_rights) do |*_args|
          call_order << :filter_datasets
          dataset_ids
        end

        subject.create(project_id, dataset_ids, exporter)

        expect(call_order).to eq([:validate_exporter, :filter_datasets])
      end
    end

    context "with empty dataset_ids array" do
      let(:empty_dataset_ids) { [] }

      before do
        allow_any_instance_of(described_class).to receive(:filter_dataset_ids_by_rights)
          .with(project_id, empty_dataset_ids).and_return([])
      end

      it "raises authorization error" do
        expect {
          subject.create(project_id, empty_dataset_ids, exporter)
        }.to raise_error(Verse::Error::Authorization, "You do not have access to any of the datasets provided")
      end
    end

    context "as Admin User", as: :admin do
      subject { described_class.new(current_auth_context) }

      it "allows access to all datasets" do
        export = subject.create(project_id, dataset_ids, exporter)

        expect(export).not_to be_nil
        expect(export.created_by_id).to eq(current_auth_context.metadata[:id])
        expect(export.project_id).to eq(project_id)
        expect(export.job_id).not_to be_nil
      end
    end

    context "as Organization Owner", as: :org_owner do
      subject { described_class.new(current_auth_context) }

      it "allows access to datasets in projects they own" do
        # Export Service
        allow(Api[:idah].dataset.projects).to receive(:index_all).with(
          filter: { id: project_id, organization_id: current_auth_context.custom_scopes[:org] },
          fields: { "dataset:projects": ["id"] }
        ).and_return(
          [double(id: project_id)]
        )
        allow(Api[:idah].dataset.datasets).to receive(:index_all).with(
          filter: { project_id:, id: dataset_ids },
          fields: { "dataset:dataset": ["id"] }
        ).and_return(
          dataset_ids.map { |id| double(id:) }
        )

        # Export Repository
        allow(Api[:idah].dataset.projects).to receive(:index_all).with(
          filter: { organization_id: current_auth_context.custom_scopes[:org] },
          fields: { "dataset:projects": ["id"] }
        ).and_return(
          [double(id: project_id)]
        )

        export = subject.create(project_id, dataset_ids, exporter)

        expect(export).not_to be_nil
        expect(export.created_by_id).to eq(current_auth_context.metadata[:id])
        expect(export.project_id).to eq(project_id)
        expect(export.job_id).not_to be_nil
      end

      it "denies access to datasets if project does not belong to their organization" do
        allow(Api[:idah].dataset.projects).to receive(:index_all).with(
          filter: { id: project_id, organization_id: current_auth_context.custom_scopes[:org] },
          fields: { "dataset:projects": ["id"] }
        ).and_return([]) # Project does not belong to org owner's organization

        expect {
          subject.create(project_id, dataset_ids, exporter)
        }.to raise_error(Verse::Error::Authorization, "You do not have access to the project provided")
      end

      context "when no org or project scope is configured" do
        subject { described_class.new(current_auth_context) }

        before do
          # Clear the org scope from the org_owner context
          current_auth_context.custom_scopes.clear
        end

        it "raises early from filter_dataset_ids_by_rights when no :org or :project scope is set" do
          expect {
            subject.create(project_id, dataset_ids, exporter)
          }.to raise_error(
            Verse::Error::Authorization,
            /Org-owner scope requires either :org or :project custom scope/
          )
        end
      end
    end

    context "as Project Owner", as: :project_owner do
      subject { described_class.new(current_auth_context) }

      it "allows access to datasets in projects they own" do
        # Export Service
        allow(Api[:idah].dataset.project_members).to receive(:index_all).with(
          filter: { project_id:, account_id: current_auth_context.metadata[:id], role: "project_owner", enabled: true },
          fields: { "dataset:project_members": ["project_id"] }
        ).and_return(
          [double(project_id:)]
        )
        allow(Api[:idah].dataset.datasets).to receive(:index_all).with(
          filter: { project_id: [project_id], id: dataset_ids },
          fields: { "dataset:dataset": ["id"] }
        ).and_return(
          dataset_ids.map { |id| double(id:) }
        )

        # Export Repository
        allow(Api[:idah].dataset.project_members).to receive(:index_all).with(
          filter: { account_id: current_auth_context.metadata[:id], role: "project_owner", enabled: true },
          fields: { "dataset:project_members": ["project_id"] }
        ).and_return(
          [double(project_id:)]
        )

        export = subject.create(project_id, dataset_ids, exporter)

        expect(export).not_to be_nil
        expect(export.created_by_id).to eq(current_auth_context.metadata[:id])
        expect(export.project_id).to eq(project_id)
        expect(export.job_id).not_to be_nil
      end

      it "denies access to datasets if user is not a project owner" do
        allow(Api[:idah].dataset.project_members).to receive(:index_all).with(
          filter: { project_id:, account_id: current_auth_context.metadata[:id], role: "project_owner", enabled: true },
          fields: { "dataset:project_members": ["project_id"] }
        ).and_return([]) # User is not a project owner

        expect {
          subject.create(project_id, dataset_ids, exporter)
        }.to raise_error(Verse::Error::Authorization, "You do not have access to the project provided")
      end

      it "denies access to datasets if they do not belong to the project" do
        allow(Api[:idah].dataset.project_members).to receive(:index_all).with(
          filter: { project_id:, account_id: current_auth_context.metadata[:id], role: "project_owner", enabled: true },
          fields: { "dataset:project_members": ["project_id"] }
        ).and_return(
          [double(project_id:)]
        )

        allow(Api[:idah].dataset.datasets).to receive(:index_all).with(
          filter: { project_id: [project_id], id: dataset_ids },
          fields: { "dataset:dataset": ["id"] }
        ).and_return([]) # No datasets belong to the project

        expect {
          subject.create(project_id, dataset_ids, exporter)
        }.to raise_error(Verse::Error::Authorization, "Dataset IDs provided do not belong to the project")
      end
    end
  end

  describe "#upload" do
    let!(:export_id) do
      repo.create(
        {
          job_id:,
          project_id:,
          created_by_id: 1
        }
      )
    end

    let(:file_path) { "/tmp/test_export.csv" }
    let(:file_content) { "id,name,value\n1,test,100" }
    let(:mock_file) do
      double(
        "File",
        path: file_path,
        read: file_content,
        size: file_content.bytesize,
        rewind: true
      )
    end

    let(:uploaded_file) do
      double(
        "UploadedFile",
        id: "uploaded_file_123",
        size: 1024,
        mime_type: "text/csv"
      )
    end

    let(:mock_storage) do
      double("Storage")
    end

    before do
      allow(File).to receive(:basename).with(file_path).and_return("test_export.csv")
      allow(Verse::Plugin).to receive(:[]).and_call_original
    end

    context "with valid file and export" do
      before do
        allow(Verse::Plugin[:shrine]).to receive(:with_storage).and_yield(mock_storage)
        allow(mock_storage).to receive(:upload).with(mock_file).and_return(uploaded_file)
        allow(repo.table.db).to receive(:after_rollback)
      end

      it "uploads the file to storage" do
        expect(mock_storage).to receive(:upload).with(mock_file).and_return(uploaded_file)

        service.upload(export_id, mock_file)
      end

      it "updates the export with file metadata" do
        service.upload(export_id, mock_file)

        updated_export = repo.find!(export_id)
        expect(updated_export.file_id).to eq("uploaded_file_123")
        expect(updated_export.filename).to eq("test_export.csv")
        expect(updated_export.size).to eq(1024)
        expect(updated_export.mime_type).to eq("text/csv")
      end

      it "returns the updated export" do
        result = service.upload(export_id, mock_file)

        expect(result).not_to be_nil
        expect(result.id.to_s).to eq(export_id)
        expect(result.file_id).to eq("uploaded_file_123")
        expect(result.filename).to eq("test_export.csv")
      end

      it "extracts filename from file path" do
        expect(File).to receive(:basename).with(file_path).and_return("test_export.csv")

        service.upload(export_id, mock_file)
      end

      it "registers rollback callback for file cleanup" do
        expect(repo.table.db).to receive(:after_rollback)

        service.upload(export_id, mock_file)
      end
    end

    context "with different file types" do
      let(:json_file) do
        double(
          "File",
          path: "/tmp/export.json",
          read: '{"data": []}',
          size: 13,
          rewind: true
        )
      end

      let(:json_uploaded_file) do
        double(
          "UploadedFile",
          id: "json_file_456",
          size: 256,
          mime_type: "application/json"
        )
      end

      before do
        allow(File).to receive(:basename).with("/tmp/export.json").and_return("export.json")
        allow(Verse::Plugin[:shrine]).to receive(:with_storage).and_yield(mock_storage)
        allow(mock_storage).to receive(:upload).with(json_file).and_return(json_uploaded_file)
        allow(repo.table.db).to receive(:after_rollback)
      end

      it "handles JSON files correctly" do
        service.upload(export_id, json_file)

        updated_export = repo.find!(export_id)
        expect(updated_export.filename).to eq("export.json")
        expect(updated_export.mime_type).to eq("application/json")
      end
    end

    context "rollback behavior" do
      before do
        allow(Verse::Plugin[:shrine]).to receive(:with_storage).and_yield(mock_storage)
        allow(mock_storage).to receive(:upload).with(mock_file).and_return(uploaded_file)
      end

      it "registers callback to delete uploaded file on rollback" do
        rollback_block = nil
        allow(repo.table.db).to receive(:after_rollback) do |&block|
          rollback_block = block
        end

        service.upload(export_id, mock_file)

        expect(rollback_block).not_to be_nil

        # Simulate rollback
        expect(mock_storage).to receive(:delete).with("uploaded_file_123")
        allow(Verse.logger).to receive(:warn)

        rollback_block.call
      end

      it "logs warning message on rollback" do
        rollback_block = nil
        allow(repo.table.db).to receive(:after_rollback) do |&block|
          rollback_block = block
        end

        service.upload(export_id, mock_file)

        allow(mock_storage).to receive(:delete)
        expect(Verse.logger).to receive(:warn)

        rollback_block.call
      end
    end

    context "when export does not exist" do
      it "raises RecordNotFound error" do
        expect {
          service.upload(99_999, mock_file)
        }.to raise_error(Verse::Error::RecordNotFound)
      end

      it "does not upload file if export not found" do
        expect(mock_storage).not_to receive(:upload)

        expect {
          service.upload(99_999, mock_file)
        }.to raise_error(Verse::Error::RecordNotFound)
      end
    end

    context "when file upload fails" do
      before do
        allow(Verse::Plugin[:shrine]).to receive(:with_storage).and_yield(mock_storage)
        allow(mock_storage).to receive(:upload).and_raise(StandardError.new("Upload failed"))
      end

      it "raises error and does not update export" do
        expect {
          service.upload(export_id, mock_file)
        }.to raise_error(StandardError, "Upload failed")

        # Verify export was not updated
        export = repo.find!(export_id)
        expect(export.file_id).to be_nil
      end
    end

    context "updating existing file" do
      let(:new_file) do
        double(
          "File",
          path: "/tmp/new_export.csv",
          read: "updated content",
          size: 15,
          rewind: true
        )
      end

      let(:new_uploaded_file) do
        double(
          "UploadedFile",
          id: "new_file_789",
          size: 2048,
          mime_type: "text/csv"
        )
      end

      before do
        # First upload
        allow(File).to receive(:basename).with(file_path).and_return("test_export.csv")
        allow(Verse::Plugin[:shrine]).to receive(:with_storage).and_yield(mock_storage)
        allow(mock_storage).to receive(:upload).with(mock_file).and_return(uploaded_file)
        allow(repo.table.db).to receive(:after_rollback)
        service.upload(export_id, mock_file)

        # Setup for second upload
        allow(File).to receive(:basename).with("/tmp/new_export.csv").and_return("new_export.csv")
        allow(mock_storage).to receive(:upload).with(new_file).and_return(new_uploaded_file)
      end

      it "replaces existing file metadata" do
        service.upload(export_id, new_file)

        updated_export = repo.find!(export_id)
        expect(updated_export.file_id).to eq("new_file_789")
        expect(updated_export.filename).to eq("new_export.csv")
        expect(updated_export.size).to eq(2048)
      end
    end
  end

  describe "read/update/delete" do
    let!(:export_id) do
      repo.create(
        {
          job_id:,
          project_id:,
          created_by_id: 1
        }
      )
    end

    context "as Organization Owner without custom scopes", as: :org_owner do
      subject { described_class.new(current_auth_context) }

      before do
        current_auth_context.custom_scopes.clear
      end

      it "raises Authorization error on index from repository scope" do
        expect {
          subject.index
        }.to raise_error(
          Verse::Error::Authorization,
          /Org-owner scope requires either :org or :project custom scope/
        )
      end

      it "raises Authorization error on show from repository scope" do
        expect {
          subject.show(export_id)
        }.to raise_error(
          Verse::Error::Authorization,
          /Org-owner scope requires either :org or :project custom scope/
        )
      end
    end

    describe "#delete" do
      it "deletes the export" do
        service.delete(export_id)

        expect { repo.find!(export_id) }.to raise_error(Verse::Error::RecordNotFound)
      end
    end

    describe "#show" do
      it "shows the export" do
        found = service.show(export_id)
        expect(found.id.to_s).to eq(export_id)
      end
    end

    describe "#index" do
      it "indexes the exports" do
        expect(service.index.to_a.size).to eq(1)
      end
    end
  end
end
