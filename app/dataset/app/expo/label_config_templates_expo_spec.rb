# frozen_string_literal: true

require "spec_helper"

RSpec.describe LabelConfigTemplatesExpo, type: :exposition, as: :system do
  let(:now) { Time.now.utc }

  let(:template_record) do
    LabelConfigTemplate::Record.new(
      {
        id: 1,
        organization_id: 1,
        name: "My Template",
        labeling_configuration: { "tools" => ["bbox"] },
        created_by_id: 1,
        updated_by_id: 1,
        created_at: now,
        updated_at: now
      }
    )
  end

  let(:template_data) do
    {
      data: {
        type: Resource::Dataset::LabelConfigTemplates,
        id: "1",
        attributes: {
          organization_id: 1,
          name: "My Template",
          labeling_configuration: { "tools" => ["bbox"] }
        }
      }
    }
  end

  let(:service) { instance_double(LabelConfigTemplate::Service) }

  before do
    allow(LabelConfigTemplate::Service).to receive(:new).and_return(service)
  end

  it "lists templates" do
    expect(service).to receive(:index).and_return([template_record])
    get "/label_config_templates"

    expect(last_response.status).to eq 200
    records = deserialize(JSON.parse(last_response.body, symbolize_names: true))

    expect(records[0].id).to eq "1"
    expect(records[0].name).to eq "My Template"
    expect(records[0].organization_id).to eq 1
  end

  it "shows a template" do
    expect(service).to receive(:show).with(1, included: []).and_return(template_record)
    get "/label_config_templates/1"

    expect(last_response.status).to eq 200
    record = deserialize(JSON.parse(last_response.body, symbolize_names: true))

    expect(record.id).to eq "1"
    expect(record.name).to eq "My Template"
  end

  it "creates a template" do
    expect(service).to receive(:create).and_return(template_record)
    post "/label_config_templates", template_data

    expect(last_response.status).to eq 201
    created_record = deserialize(JSON.parse(last_response.body, symbolize_names: true))

    expect(created_record.id).to eq "1"
    expect(created_record.name).to eq "My Template"
  end

  it "updates a template" do
    expect(service).to receive(:update) do |args|
      expect(args.id).to eq 1
      template_record
    end

    patch "/label_config_templates/1", template_data
    expect(last_response.status).to eq 200
  end

  it "deletes a template" do
    expect(service).to receive(:delete).with(1).and_return(true)
    delete "/label_config_templates/1"

    expect(last_response.status).to eq 204
  end
end
