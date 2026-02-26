# frozen_string_literal: true

# frozen_string_literal:

RSpec.describe Exports::Service, database: true do
  let(:auth_context) { Verse::Auth::Context[:system] }
  let(:service) { described_class.new(auth_context) }
  let(:repo) { service.exports }

  let(:project_id) { "019c9428-50d4-7b1b-a8bb-68cd3a284cef" }
  let(:job_id) { "019bba87-650e-74e8-a68a-bc49bfff2527" }

  describe "#create" do
    subject {
      auth_context.metadata[:id] = 1 # Simulate a user with ID 1
      described_class.new(auth_context)
    }

    before do
      # By default, always allow export class
      allow(Exports::Registry).to receive(:valid_export_class?).and_return(true)
    end

    it "creates an export and a job" do
      export = subject.create(project_id, [1, 2, 3], "MyExporter")

      expect(export).not_to be_nil
      expect(export.job_id).not_to be_nil

      job = Jobs::Service.new(auth_context).show(export.job_id)

      expect(job.job_class).to eq "Exports::Job"
      expect(job.arguments).to eq(
        {
          dataset_ids: [1, 2, 3],
          exporter: "MyExporter"
        }
      )
    end

    it "raises an error if invalid export class" do
      allow(Exports::Registry).to receive(:valid_export_class?).with("bad_class").and_return(false)

      expect {
        subject.create(project_id, [1, 2, 3], "bad_class")
      }.to raise_error(Verse::Error::Authorization, "invalid export format: `bad_class`")
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
