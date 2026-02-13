# frozen_string_literal: true
RSpec.describe Exports::Service do
  let(:auth_context) do
    Verse::Auth::Context[:system]
  end

  let(:service) { described_class.new(auth_context) }
  let(:repo) { service.exports }

  describe "#create" do
    before do
      # By default, always allow export class
      allow(Export::Registry).to receive(:is_valid_export_class?).and_return(true)
    end

    it "creates an export and a job" do
      export = service.create([1, 2, 3], 1, "MyExporter")
      expect(export).to be_present
      expect(export.job_id).to be_present

      job = Jobs::Service.new(auth_context).show(export.job_id)

      expect(job.job_class).to eq "Exports::Job"
      expect(job.arguments).to eq(
        {
          "dataset_ids" => [1, 2, 3],
          "exporter" => "MyExporter"
        }
      )
    end

    it "raises an error if invalid export class" do
      allow(Export::Registry).to receive(:is_valid_export_class?).with("bad_class").and_return(false)

      expect {
        service.create([1, 2, 3], 1, "bad_class")
      }.to raise_error(Verse::Error::Authorization, "invalid export format: `bad_class`")
    end
  end

  describe "read/update/delete" do
    let!(:export) do
       repo.create({
        job_id: 1,
        created_by: 1
      })
    end

    describe "#delete" do
      it "deletes the export" do
        service.delete(export.id)

        expect { repo.find!(export.id) }.to raise_error(Verse::Error::RecordNotFound)
      end
    end

    describe "#show" do
      it "shows the export" do
        found = service.show(export.id)
        expect(found.id).to eq(export.id)
      end
    end

    describe "#index" do
      it "indexes the exports" do
        expect(service.index.to_a.size).to eq(1)
      end
    end
  end
end