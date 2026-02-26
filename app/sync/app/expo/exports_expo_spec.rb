# frozen_string_literal: true

RSpec.describe ExportsExpo, type: :exposition, as: :system do
  let(:now) { Time.now.utc }

  let(:export_id) { "019bba87-650e-74e8-a68a-bc49bfff2527" }
  let(:job_id) { "019bba87-650e-74e8-a68a-bc49bfff2528" }
  let(:project_id) { "415bba87-650e-74e8-a68a-bc49bfff2529" }
  let(:created_by_id) { 1 }

  let(:export) {
    Exports::Record.new(
      {
        id: export_id,
        job_id:,
        project_id:,
        created_by_id:,
        file_id: "test_file_id",
        filename: "export.zip",
        mime_type: "application/zip",
        size: 1024,
        created_at: now
      }
    )
  }

  let(:export_without_file) {
    Exports::Record.new(
      {
        id: export_id,
        job_id:,
        project_id:,
        created_by_id:,
        file_id: nil,
        filename: nil,
        mime_type: nil,
        size: 0,
        created_at: now
      }
    )
  }

  describe "GET /exports" do
    it "returns list of exports" do
      expect_any_instance_of(Exports::Repository).to receive(:index).and_return([export])

      get "/exports"

      expect(last_response.status).to eq 200
      body = JSON.parse(last_response.body, symbolize_names: true)
      record = deserialize body

      expect(record[0].id).to eq export_id
      expect(record[0].job_id).to eq job_id
      expect(record[0].project_id).to eq project_id
      expect(record[0].filename).to eq "export.zip"
      expect(record[0].mime_type).to eq "application/zip"
      expect(record[0].size).to eq 1024
    end
  end

  describe "GET /exports/:id" do
    it "returns export by id" do
      expect_any_instance_of(Exports::Repository).to receive(:find!).and_return(export)

      get "/exports/#{export_id}"

      expect(last_response.status).to eq 200
      body = JSON.parse(last_response.body, symbolize_names: true)
      record = deserialize body

      expect(record.id).to eq export_id
      expect(record.job_id).to eq job_id
      expect(record.project_id).to eq project_id
      expect(record.filename).to eq "export.zip"
      expect(record.mime_type).to eq "application/zip"
      expect(record.size).to eq 1024
    end
  end

  describe "GET /exports/:id/download" do
    it "downloads export file" do
      mock_io = StringIO.new("export content")

      expect_any_instance_of(Exports::Service).to receive(:show).with(export_id).and_return(export)
      expect(export).to receive(:open).and_return(mock_io)

      get "/exports/#{export_id}/download"

      expect(last_response.status).to eq 200
      expect(last_response.headers["Content-Disposition"]).to eq "attachment;filename=export.zip"
      expect(last_response.content_type).to eq "application/zip"
    end
  end

  describe "POST /exports/export" do
    let(:dataset_ids) { [1, 2, 3] }
    let(:exporter) { "TestExporter" }

    it "creates export job" do
      expect_any_instance_of(Exports::Service).to receive(:create)
        .with(project_id.to_i, dataset_ids, exporter)
        .and_return(export_without_file)

      post "/exports/export",
           {
             project_id: project_id.to_i,
             dataset_ids:,
             exporter:
           }

      expect(last_response.status).to eq 200
    end

    it "requires project_id parameter" do
      post "/exports/export",
           {
             dataset_ids:,
             exporter:
           }

      expect(last_response.status).to eq 422
    end

    it "requires dataset_ids parameter" do
      post "/exports/export",
           {
             project_id: project_id.to_i,
             exporter:
           }

      expect(last_response.status).to eq 422
    end

    it "requires exporter parameter" do
      post "/exports/export",
           {
             project_id: project_id.to_i,
             dataset_ids:
           }

      expect(last_response.status).to eq 422
    end
  end

  describe "GET /exports/formats" do
    let(:modalities) { ["image", "video"] }
    let(:format_details) {
      [
        {
          name: "Format A",
          description: "Description for Format A",
          exporter: "TestExporterA"
        },
        {
          name: "Format B",
          description: "Description for Format B",
          exporter: "TestExporterB"
        }
      ]
    }

    it "returns available export formats for given modalities" do
      expect(Exports::Registry).to receive(:list_export_format_details)
        .with(modalities)
        .and_return(format_details)

      get "/exports/formats?modalities[]=#{modalities[0]}&modalities[]=#{modalities[1]}"

      expect(last_response.status).to eq 200
      body = JSON.parse(last_response.body, symbolize_names: true)

      expect(body).to be_an(Array)
      expect(body.size).to eq 2
      expect(body[0][:name]).to eq "Format A"
      expect(body[0][:description]).to eq "Description for Format A"
      expect(body[0][:exporter]).to eq "TestExporterA"
      expect(body[1][:name]).to eq "Format B"
      expect(body[1][:description]).to eq "Description for Format B"
      expect(body[1][:exporter]).to eq "TestExporterB"
    end

    it "requires modalities parameter" do
      get "/exports/formats"

      expect(last_response.status).to eq 422
    end

    it "returns empty array when no formats match" do
      expect(Exports::Registry).to receive(:list_export_format_details)
        .with(["unknown"])
        .and_return([])

      get "/exports/formats?modalities[]=unknown"

      expect(last_response.status).to eq 200
      body = JSON.parse(last_response.body, symbolize_names: true)

      expect(body).to be_an(Array)
      expect(body).to be_empty
    end
  end
end
