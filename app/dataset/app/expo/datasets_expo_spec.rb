# frozen_string_literal: true

require "spec_helper"

RSpec.describe DatasetsExpo, type: :exposition, as: :system do
  let(:now) { Time.now.utc }

  let(:uuid) { UUIDv7.generate }

  let(:dataset_record) do
    Dataset::Record.new(
      {
        id: uuid,
        modality: "image_labeling",
        labels: ["cat", "dog"],
        configuration: { "width" => 100, "height" => 100 },
        status: "pending",
        progress: 0.0,
        project_id: 1,
        created_at: now,
        updated_at: now
      }
    )
  end

  let(:dataset_data) do
    {
      data:
        {
          type: Resource::Dataset::Datasets,
          id: uuid,
          attributes: {
            modality: "image_labeling",
            labels: ["cat", "dog"],
            configuration: { "width" => 100, "height" => 100 },
            status: "pending",
            progress: 0.0,
            project_id: 1,
            created_at: now.iso8601,
            updated_at: now.iso8601
          }
        }
    }
  end

  let(:service) { instance_double(Dataset::Service) }

  before do
    allow(Dataset::Service).to receive(:new).and_return(service)
  end

  it "index" do
    expect(service).to receive(:index).and_return([dataset_record])
    get "/datasets"

    expect(last_response.status).to eq 200
    body = JSON.parse(last_response.body, symbolize_names: true)
    record = deserialize(body)
    expect(record[0].id).to eq uuid
    expect(record[0].modality).to eq "image_labeling"
  end

  it "show" do
    expect(service).to receive(:show).with(uuid, included: []).and_return(dataset_record)
    get "/datasets/#{uuid}"

    expect(last_response.status).to eq 200
    body = JSON.parse(last_response.body, symbolize_names: true)
    record = deserialize(body)
    expect(record.id).to eq uuid
    expect(record.modality).to eq "image_labeling"
  end

  it "create" do
    expect(service).to receive(:create).and_return(dataset_record)
    post "/datasets", dataset_data

    expect(last_response.status).to eq 201
  end

  it "update" do
    expect(service).to receive(:update) do |args|
      expect(args.id).to eq uuid
      expect(args.attributes[:labels]).to eq ["cat", "dog"]
      dataset_record
    end

    patch "/datasets/#{uuid}", dataset_data
    expect(last_response.status).to eq 200
  end

  describe "Delivery Date HTTP contract" do
    [:post, :patch].each do |verb|
      context "on #{verb}" do
        let(:path) { verb == :post ? "/datasets" : "/datasets/#{uuid}" }
        let(:action) { verb == :post ? :create : :update }

        it "rejects an invalid date before calling the service" do
          expect(service).not_to receive(action)
          public_send(
            verb,
            path,
            { data: { type: Resource::Dataset::Datasets,
                      attributes: { delivery_date: "2030-02-30" } } }
          )
          expect(last_response.status).to eq(422)
        end

        ["2030-01-02", nil].each do |value|
          it "accepts delivery_date #{value.inspect}" do
            date = value && Date.iso8601(value)
            expect(service).to receive(action) do |record|
              expect(record.attributes).to have_key(:delivery_date)
              expect(record.attributes[:delivery_date]).to eq(date)
              Dataset::Record.new(dataset_record.fields.merge(delivery_date: date))
            end
            public_send(
              verb,
              path,
              { data: { type: Resource::Dataset::Datasets,
                        attributes: { delivery_date: value } } }
            )
            expect(last_response.status).to eq(verb == :post ? 201 : 200)
            expect(JSON.parse(last_response.body).dig("data", "attributes", "delivery_date")).to eq(value)
          end
        end

        it "does not turn an omitted date into explicit null" do
          expect(service).to receive(action) do |record|
            expect(record.attributes).not_to have_key(:delivery_date)
            dataset_record
          end
          public_send(verb, path, { data: { type: Resource::Dataset::Datasets, attributes: { name: "Unrelated" } } })
          expect(last_response.status).to eq(verb == :post ? 201 : 200)
        end
      end
    end
  end

  it "destroy" do
    expect(service).to receive(:delete).with(uuid).and_return(true)
    delete "/datasets/#{uuid}"

    expect(last_response.status).to eq 204
  end

  describe "PATCH /datasets/:id/feedback_configuration" do
    it "updates the feedback configuration" do
      new_config = {
        key1: { label: "Fix this", description: "It's broken" },
        key2: { label: "Great work" }
      }

      expect(service).to receive(:update_feedback_configuration)
        .with(uuid, new_config)
        .and_return(new_config)

      patch "/datasets/#{uuid}/feedback_configuration", { feedback_configuration: new_config }
      expect(last_response.status).to eq 200
    end
  end

  describe "GET /datasets/:id/feedback_keys_in_use" do
    it "returns keys referenced by notes" do
      expect(service).to receive(:feedback_keys_in_use)
        .with(uuid)
        .and_return({ keys: ["key1", "key3"] })

      get "/datasets/#{uuid}/feedback_keys_in_use"

      expect(last_response.status).to eq 200
      body = JSON.parse(last_response.body, symbolize_names: true)
      expect(body[:data][:keys]).to match_array(%w[key1 key3])
    end
  end
end

RSpec.describe DatasetsExpo, type: :exposition, database: true, as: :admin do
  let(:system_context) { Verse::Auth::Context[:system] }
  let(:datasets) { Dataset::Repository.new(system_context) }
  let!(:project_id) do
    Project::Repository.new(system_context).create(
      name: "Dataset pagination", organization_id: 1, created_by_email: "admin@example.com"
    )
  end

  describe "offset-aware Dataset pagination" do
    [999, 1000, 1001, 2005].each do |total|
      it "keeps metadata and rows correct for #{total} Datasets" do
        ids = Array.new(total) { UUIDv7.generate }.sort
        datasets.client do |db|
          db[:datasets].multi_insert(
            ids.map do |id|
              { id: id, project_id: project_id, name: "Dataset", modality: "video",
                workflow_configuration: Sequel.pg_jsonb({}), labeling_configuration: Sequel.pg_jsonb({}) }
            end
          )
        end
        final = (total / 10.0).ceil
        [99, 100, 101, final, final + 1].uniq.each do |page|
          get "/datasets?#{Rack::Utils.build_nested_query(
            filter: { project_id: project_id },
            sort: "id",
            page: { number: page, size: 10 },
            count: true,
            fields: { Resource::Dataset::Datasets => ["id"] }
          )}"
          expect(last_response.status).to eq(200), last_response.body
          body = JSON.parse(last_response.body)
          offset = (page - 1) * 10
          remaining = [total - offset, 0].max
          expect(body.fetch("meta")).to include("count" => offset + [remaining, 1000].min, "more" => remaining >= 1000)
          expect(body.fetch("data").map { |record| record["id"] }).to eq(ids.drop(offset).take(10))
        end
      end
    end

    it "returns recoverable metadata after records disappear from a later page" do
      ids = Array.new(11) { UUIDv7.generate }.sort
      datasets.client do |db|
        db[:datasets].multi_insert(
          ids.map { |id|
            { id: id, project_id: project_id, name: "Dataset", modality: "video",
              workflow_configuration: Sequel.pg_jsonb({}), labeling_configuration: Sequel.pg_jsonb({}) }
          }
        )
        db[:datasets].where(id: ids.last).delete
      end
      get "/datasets?#{Rack::Utils.build_nested_query(
        filter: { project_id: project_id }, page: { number: 2, size: 10 }, count: true
      )}"
      expect(last_response.status).to eq(200), last_response.body
      body = JSON.parse(last_response.body)
      expect(body.fetch("data")).to be_empty
      expect(body.fetch("meta")).to include("count" => 10, "more" => false)
    end
  end
end

RSpec.describe DatasetsExpo, type: :exposition, database: true, as: :admin do
  let(:system_context) { Verse::Auth::Context[:system] }
  let(:datasets) { Dataset::Repository.new(system_context) }
  let!(:project_id) do
    Project::Repository.new(system_context).create(
      name: "Delivery breakdown",
      organization_id: 1,
      created_by_email: "admin@example.com"
    )
  end

  def delivery_dataset(date, status: "pending", project: project_id)
    datasets.create(
      project_id: project,
      modality: "video",
      labels: [],
      labeling_configuration: {},
      workflow_configuration: {},
      delivery_date: date,
      status: status
    )
  end

  def read_breakdown(day: "2026-11-17", ids: nil, project: project_id)
    filter = { project_id: project }
    filter[:dataset_id] = ids if ids
    get "/datasets/delivery_breakdown?#{Rack::Utils.build_nested_query(filter: filter, day: day)}"
    JSON.parse(last_response.body)
  end

  describe "GET /datasets/delivery_breakdown" do
    it "counts overdue, today, and tomorrow while excluding later dates" do
      ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-20", "2026-11-25", nil].each do |date|
        delivery_dataset(date)
      end
      delivery_dataset("2026-11-16", status: "completed")
      expect(read_breakdown).to eq(
        "meta" => { "overdue" => 1, "due_today" => 1, "due_tomorrow" => 1 }
      )
      expect(last_response.status).to eq(200), last_response.body
    end

    it "returns exact counts above 1000 without list pagination" do
      datasets.client do |db|
        db[:datasets].multi_insert(
          Array.new(1001) do
            { id: UUIDv7.generate, project_id: project_id, modality: "video", labeling_configuration: "{}",
              workflow_configuration: "{}", delivery_date: Date.new(2026, 11, 16) }
          end
        )
      end
      expect(read_breakdown.dig("meta", "overdue")).to eq(1001)
      expect(last_response.status).to eq(200)
    end

    it "supports selected and single-Dataset scopes and uses each request's local day" do
      today = delivery_dataset("2026-11-17")
      tomorrow = delivery_dataset("2026-11-18")
      delivery_dataset("2026-11-16")
      expect(read_breakdown(ids: [today]).fetch("meta")).to include(
        "overdue" => 0,
        "due_today" => 1,
        "due_tomorrow" => 0
      )
      expect(read_breakdown(ids: [today, tomorrow]).fetch("meta")).to include("due_today" => 1, "due_tomorrow" => 1)
      expect(read_breakdown(day: "2026-11-18", ids: [today, tomorrow]).fetch("meta"))
        .to include("overdue" => 1, "due_today" => 1, "due_tomorrow" => 0)
    end

    it "handles leap/year boundaries and no-date/completed Datasets" do
      delivery_dataset("2024-02-29")
      delivery_dataset(nil)
      delivery_dataset("2024-02-28", status: "completed")
      expect(read_breakdown(day: "2024-02-28").dig("meta", "due_tomorrow")).to eq(1)
      delivery_dataset("2027-01-01")
      expect(read_breakdown(day: "2026-12-31").dig("meta", "due_tomorrow")).to eq(1)
    end

    it "returns zeros for an empty scope" do
      expect(read_breakdown.fetch("meta")).to eq(
        "overdue" => 0,
        "due_today" => 0,
        "due_tomorrow" => 0
      )
    end

    ["invalid", "2026-2-1", "2026-02-30", "2026-11-17T00:00:00Z"].each do |day|
      it "rejects invalid reporting date #{day}" do
        read_breakdown(day: day)
        expect(last_response.status).to eq(422)
      end
    end

    it "rejects cross-project Dataset IDs" do
      foreign = Project::Repository.new(system_context).create(
        name: "Foreign",
        organization_id: 2,
        created_by_email: "other@example.com"
      )
      id = delivery_dataset("2026-11-17", project: foreign)
      read_breakdown(ids: [id])
      expect(last_response.status).to eq(422)
    end

    it "requires Project Owner membership", as: :project_owner do
      read_breakdown
      expect(last_response.status).to be_between(403, 404)
      ProjectMember::Repository.new(system_context).create(
        project_id: project_id,
        account_id: 3,
        role: "project_owner",
        email: "owner@example.com",
        invited_by_id: 1
      )
      read_breakdown
      expect(last_response.status).to eq(200)
    end

    it "does not expose another organization's Datasets", as: :org_owner do
      foreign = Project::Repository.new(system_context).create(
        name: "Foreign",
        organization_id: 2,
        created_by_email: "other@example.com"
      )
      read_breakdown(project: foreign)
      expect(last_response.status).to be_between(403, 404)
    end
  end
end
