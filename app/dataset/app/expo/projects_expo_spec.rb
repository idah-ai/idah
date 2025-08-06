# frozen_string_literal: true

require "spec_helper"

RSpec.describe ProjectsExpo, type: :exposition, as: :system do
  let(:now) { Time.now.utc }

  let(:uuid) { UUIDv7.generate }

  let(:project_record) do
    Project::Record.new(
      {
        id: uuid,
        name: "Test Project",
        description: "A test project",
        created_by_id: 1,
        created_at: now,
        updated_at: now
      }
    )
  end

  let(:project_data) do
    {
      data:
        {
          type: Resource::Dataset::Datasets,
          id: uuid,
          attributes: {
            name: "Test Project",
            description: "A test project",
            created_by_id: 1,
            created_at: now.iso8601,
            updated_at: now.iso8601
          }
        }
    }
  end

  let(:service) { instance_double(Project::Service) }

  before do
    allow(Project::Service).to receive(:new).and_return(service)
  end

  it "index" do
    expect(service).to receive(:index).and_return([project_record])
    get "/projects"
    expect(last_response.status).to eq 200
    body = JSON.parse(last_response.body, symbolize_names: true)
    record = deserialize(body)
    expect(record[0].id).to eq uuid
    expect(record[0].name).to eq "Test Project"
  end

  it "show" do
    expect(service).to receive(:show).with(uuid, included: []).and_return(project_record)
    get "/projects/#{uuid}"

    expect(last_response.status).to eq 200
    body = JSON.parse(last_response.body, symbolize_names: true)
    record = deserialize(body)
    expect(record.id).to eq uuid
    expect(record.name).to eq "Test Project"
  end

  it "create" do
    expect(service).to receive(:create).and_return(project_record)
    post "/projects", project_data

    expect(last_response.status).to eq 201
  end

  it "update" do
    expect(service).to receive(:update) do |args|
      expect(args.id).to eq uuid
      expect(args.attributes[:name]).to eq "Test Project"
      project_record
    end

    patch "/projects/#{uuid}", project_data
    expect(last_response.status).to eq 200
  end

  it "destroy" do
    expect(service).to receive(:delete).with(uuid).and_return(true)
    delete "/projects/#{uuid}"

    expect(last_response.status).to eq 204
  end
end
