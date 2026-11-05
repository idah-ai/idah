# frozen_string_literal: true

require "spec_helper"

RSpec.describe EntriesExpo, type: :exposition, as: :system do
  let(:now) { Time.now.utc }

  let(:uuid) { UUIDv7.generate }

  let(:entry_record) do
    Entry::Record.new(
      {
        id: uuid,
        priority: 1,
        wf_step: "start",
        status: "pending",
        assigned_to_id: 1,
        created_at: now,
        updated_at: now
      }
    )
  end

  let(:entry_data) do
    {
      data:
        {
          type: Resource::Dataset::Entries,
          id: uuid,
          attributes: {
            priority: 1,
            assigned_to_id: 1,
            created_at: now.iso8601,
            updated_at: now.iso8601
          }
        }
    }
  end

  let(:service) { instance_double(Entry::Service) }

  before do
    allow(Entry::Service).to receive(:new).and_return(service)
  end

  it "index" do
    expect(service).to receive(:index).and_return([entry_record])
    get "/entries"
    expect(last_response.status).to eq 200
    body = JSON.parse(last_response.body, symbolize_names: true)
    record = deserialize(body)
    expect(record[0].id).to eq uuid
    expect(record[0].status).to eq "pending"
  end

  it "passes selected entry IDs to the service" do
    expect(service).to receive(:index) do |filters, **_options|
      expect(filters.transform_keys(&:to_s)).to include("id__in" => [uuid])
      [entry_record]
    end
    get "/entries?filter[id__in][]=#{uuid}&page[size]=1"
    expect(last_response.status).to eq(200), last_response.body
  end

  it "passes Delivery Date range filters to the service" do
    expect(service).to receive(:index) do |filters, **_options|
      expect(filters.transform_keys(&:to_s)).to include(
        "delivery_date__gte" => "2026-11-01", "delivery_date__lte" => "2026-11-10"
      )
      [entry_record]
    end
    get "/entries?filter[delivery_date__gte]=2026-11-01&filter[delivery_date__lte]=2026-11-10"
    expect(last_response.status).to eq(200)
  end

  it "show" do
    expect(service).to receive(:show).with(uuid, included: []).and_return(entry_record)
    get "/entries/#{uuid}"
    expect(last_response.status).to eq 200
    body = JSON.parse(last_response.body, symbolize_names: true)
    record = deserialize(body)
    expect(record.id).to eq uuid
    expect(record.status).to eq "pending"
  end

  it "create" do
    expect(service).to receive(:create).and_return(entry_record)
    post "/entries", entry_data

    expect(last_response.status).to eq 201
  end

  it "update" do
    expect(service).to receive(:update) do |args|
      expect(args.id).to eq uuid
      expect(args.attributes[:priority]).to eq 1
      entry_record
    end

    patch "/entries/#{uuid}", entry_data
    expect(last_response.status).to eq 200
  end

  it "assign member" do
    expect(service).to receive(:assign_member) do |id, assigned_to_id|
      expect(id).to eq uuid
      expect(assigned_to_id).to eq 1
      entry_record
    end

    patch "/entries/#{uuid}/assign",
          {
            data: {
              type: Resource::Dataset::Entries,
              id: uuid,
              attributes: {
                assigned_to_id: 1,
              }
            }
          }

    expect(last_response.status).to eq 200
  end

  describe "Delivery Date HTTP contract" do
    [:post, :patch].each do |verb|
      context "on #{verb}" do
        let(:path) { verb == :post ? "/entries" : "/entries/#{uuid}" }
        let(:action) { verb == :post ? :create : :update }

        it "rejects an invalid date before calling the service" do
          expect(service).not_to receive(action)
          public_send(
            verb,
            path,
            { data: { type: Resource::Dataset::Entries,
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
              Entry::Record.new(entry_record.fields.merge(delivery_date: date))
            end
            public_send(
              verb,
              path,
              { data: { type: Resource::Dataset::Entries,
                        attributes: { delivery_date: value } } }
            )
            expect(last_response.status).to eq(verb == :post ? 201 : 200)
            expect(JSON.parse(last_response.body).dig("data", "attributes", "delivery_date")).to eq(value)
          end
        end

        it "does not turn an omitted date into explicit null" do
          expect(service).to receive(action) do |record|
            expect(record.attributes).not_to have_key(:delivery_date)
            entry_record
          end
          public_send(verb, path, { data: { type: Resource::Dataset::Entries, attributes: { name: "Unrelated" } } })
          expect(last_response.status).to eq(verb == :post ? 201 : 200)
        end
      end
    end
  end

  describe "POST /entries/next" do
    it "claims an entry through the service" do
      expect(service).to receive(:select_next).with(dataset_id: uuid, wf_step: "review").and_return(entry_record)
      post "/entries/next", { dataset_id: uuid, wf_step: "review" }
      expect(last_response.status).to eq(200)
      expect(JSON.parse(last_response.body).dig("data", "id")).to eq(uuid)
    end

    it "returns null when no entry is claimable" do
      expect(service).to receive(:select_next).and_return(nil)
      post "/entries/next", { dataset_id: uuid, wf_step: "review" }
      expect(last_response.status).to eq(200)
      expect(JSON.parse(last_response.body)).to eq("data" => nil)
    end

    it "rejects missing workflow before calling the service" do
      expect(service).not_to receive(:select_next)
      post "/entries/next", { dataset_id: uuid }
      expect(last_response.status).to eq(422)
    end
  end

  it "destroy" do
    expect(service).to receive(:delete).with(uuid).and_return(true)
    delete "/entries/#{uuid}"

    expect(last_response.status).to eq 204
  end

  describe "#submit" do
    it "calls service.submit with entry_id and no options" do
      expect(service).to receive(:submit).with(uuid).and_return(entry_record)

      post "/entries/#{uuid}/submit"

      expect(last_response.status).to eq 200
      body = JSON.parse(last_response.body, symbolize_names: true)
      record = deserialize(body)
      expect(record.id).to eq uuid
    end

    it "calls service.submit with entry_id and options" do
      expect(service).to receive(:submit).with(uuid, { approved: true }).and_return(entry_record)

      post "/entries/#{uuid}/submit",
           {
             data: {
               attributes: {
                 approved: true
               }
             }
           }

      expect(last_response.status).to eq 200
      body = JSON.parse(last_response.body, symbolize_names: true)
      record = deserialize(body)
      expect(record.id).to eq uuid
    end

    it "handles submit with multiple options" do
      expect(service).to receive(:submit).with(
        uuid,
        { approved: false, comment: "Needs revision" }
      ).and_return(entry_record)

      post "/entries/#{uuid}/submit",
           {
             data: {
               attributes: {
                 approved: false,
                 comment: "Needs revision"
               }
             }
           }

      expect(last_response.status).to eq 200
    end
  end

  describe "#reopen" do
    it "returns 422 when target_step is missing" do
      post "/entries/#{uuid}/reopen"

      expect(last_response.status).to eq 422
      expect(JSON.parse(last_response.body, symbolize_names: true)[:errors]).to eq(
        [
          {
            status: 422,
            title: "Verse::Error::ValidationFailed",
            detail: "is required",
            source: { pointer: "/data" }
          }
        ]
      )
      expect(service).not_to receive(:reopen)
    end

    it "calls service.reopen with target_step" do
      expect(service).to receive(:reopen).with(uuid, target_step: "review").and_return(entry_record)

      post "/entries/#{uuid}/reopen",
           {
             data: {
               attributes: {
                 target_step: "review"
               }
             }
           }

      expect(last_response.status).to eq 200
      record = deserialize(JSON.parse(last_response.body, symbolize_names: true))
      expect(record.id).to eq uuid
    end
  end

  describe "#reopen_targets" do
    it "calls service.reopen_targets with entry_id and returns the steps" do
      expect(service).to receive(:reopen_targets).with(uuid).and_return(["annotate", "review"])

      get "/entries/#{uuid}/reopen_targets"

      expect(last_response.status).to eq 200
      body = JSON.parse(last_response.body, symbolize_names: true)
      expect(body[:data]).to eq({ data: ["annotate", "review"] })
    end
  end

  describe "#error" do
    it "calls service.error with entry_id and options" do
      expect(service).to receive(:error).with(
        uuid,
        { message: "Processing failed" }
      ).and_return(entry_record)

      post "/entries/#{uuid}/error",
           {
             data: {
               attributes: {
                 message: "Processing failed"
               }
             }
           }

      expect(last_response.status).to eq 200
      body = JSON.parse(last_response.body, symbolize_names: true)
      record = deserialize(body)
      expect(record.id).to eq uuid
    end
  end

  describe "#on_job_completed" do
    it "advances entry workflow when job is completed" do
      job_id = "123"

      expect(
        service
      ).to(
        receive(:complete_entry_processing).with(job_id)
      )

      Verse.publish_resource_event(
        resource_type: "media:jobs",
        resource_id: job_id,
        event: "completed",
        payload: {
          resource_id: job_id
        }
      )
    end
  end

  describe "#on_job_errored" do
    it "marks entries as errored when job fails" do
      job_id = "789"

      expect(
        service
      ).to(
        receive(:mark_entries_status_as).with(job_id, "errored")
      )

      Verse.publish_resource_event(
        resource_type: "media:jobs",
        resource_id: job_id,
        event: "errored",
        payload: {
          resource_id: job_id
        }
      )
    end
  end

  describe "#on_project_member_disabled" do
    it "unassigns entries when a project member is disabled" do
      account_id = 1
      project_id = 2
      expect(service).to(receive(:unassign_account_entries).with(account_id, project_id))

      Verse.publish_resource_event(
        resource_type: Resource::Dataset::ProjectMembers,
        resource_id: 1,
        event: "updated",
        payload: {
          args: [{ disabled_at: Time.now }],
          metadata: {
            project_member_account_id: account_id,
            project_id: project_id
          }
        }
      )
    end

    it "does not unassign entries if project member disabled_at param is nil or not present" do
      account_id = 1
      project_id = 2
      expect(service).not_to(receive(:unassign_account_entries))

      Verse.publish_resource_event(
        resource_type: Resource::Dataset::ProjectMembers,
        resource_id: 1,
        event: "updated",
        payload: {
          args: [],
          metadata: {
            project_member_account_id: account_id,
            project_member_project_id: project_id
          }
        }
      )
    end
  end
end

# Real-service integration coverage stays outside the service-stubbed group above.
RSpec.describe EntriesExpo, type: :exposition, database: true, as: :admin do
  let(:system_context) { Verse::Auth::Context[:system] }
  let(:entries) { Entry::Repository.new(system_context) }
  let!(:project_id) do
    Project::Repository.new(system_context).create(
      name: "Completion API",
      organization_id: 1,
      created_by_email: "test@example.com"
    )
  end
  let!(:dataset_id) do
    Dataset::Repository.new(system_context).create(
      project_id:,
      modality: "video",
      labels: [],
      labeling_configuration: {},
      workflow_configuration: {}
    )
  end
  let(:forged) { "2000-01-01T00:00:00Z" }

  it "returns an offset-bearing timestamp and cannot overwrite it through ordinary updates" do
    id = entries.create(project_id:, dataset_id:, status: "completed", wf_step: "done")
    original = entries.find!(id).completed_at
    patch "/entries/#{id}", { data: { type: Resource::Dataset::Entries, id:, attributes: { name: "Edited", completed_at: forged } } }
    expect(last_response.status).to eq(200)
    expect(entries.find!(id).name).to eq("Edited")
    expect(entries.find!(id).completed_at).to eq(original)
    timestamp = JSON.parse(last_response.body).dig("data", "attributes", "completed_at")
    expect(timestamp).to match(/(?:Z|[+-]\d{2}:?\d{2})\z/)
    expect(Time.parse(timestamp).to_i).to eq(original.to_i)
    patch "/entries/#{id}", { data: { type: Resource::Dataset::Entries, id:, attributes: { priority: 3, completed_at: nil } } }
    expect(last_response.status).to eq(200)
    expect(entries.find!(id).completed_at).to eq(original)
  end

  it "does not accept a caller-chosen completion time on creation" do
    post "/entries",
         {
           data: {
             type: Resource::Dataset::Entries,
             attributes: { resource: UUIDv7.generate, status: "completed", wf_step: "done", completed_at: forged },
             relationships: { dataset: { data: { type: Resource::Dataset::Datasets, id: dataset_id } } }
           }
         }
    expect(last_response.status).to eq(201)
    body = JSON.parse(last_response.body)
    completed_at = entries.find!(body.dig("data", "id")).completed_at
    expect(completed_at).to be_a(Time)
    expect(completed_at).not_to eq(Time.iso8601(forged))
  end

  describe "completion range filters" do
    let!(:entry_id) { entries.create(project_id:, dataset_id:, status: "completed", wf_step: "done") }
    let(:completed_at) { entries.find!(entry_id).completed_at }

    def read_entries(extra = {}, count: false)
      params = { filter: { project_id:, dataset_id: [dataset_id], status__in: ["completed"] }.merge(extra),
                 sort: "id", page: { number: 1, size: 1000 }, count:,
                 fields: { Resource::Dataset::Entries => ["id", "completed_at"] } }
      get "/entries?#{Rack::Utils.build_nested_query(params)}"
      expect(last_response.status).to eq(200), last_response.body
      JSON.parse(last_response.body)
    end

    it "normalizes offset-bearing bounds and includes exact lower and upper timestamps" do
      lower = completed_at.getlocal("+07:00").iso8601(6)
      upper = completed_at.getlocal("-08:00").iso8601(6)
      expect(
        read_entries({ completed_at__gte: lower, completed_at__lte: upper })["data"].map { |e|
          e["id"]
        }
      ).to eq([entry_id])
      expect(
        read_entries(
          { completed_at__lte: (completed_at - Rational(
            1,
            1_000_000
          )).iso8601(6) }
        )["data"]
      ).to be_empty
      expect(
        read_entries(
          { completed_at__gte: (completed_at + Rational(
            1,
            1_000_000
          )).iso8601(6) }
        )["data"]
      ).to be_empty
    end

    it "includes the final microsecond of the selected local date but excludes the next midnight" do
      next_entry = entries.create(project_id:, dataset_id:, status: "completed", wf_step: "done")
      inclusive_end = Time.iso8601("2026-10-30T23:59:59.999999-07:00").utc
      next_midnight = Time.iso8601("2026-10-31T00:00:00-07:00").utc
      entries.client do |db|
        db.run("ALTER TABLE entries DISABLE TRIGGER trg_set_entry_completed_at")
        begin
          db[:entries].where(id: entry_id).update(completed_at: inclusive_end)
          db[:entries].where(id: next_entry).update(completed_at: next_midnight)
        ensure
          db.run("ALTER TABLE entries ENABLE TRIGGER trg_set_entry_completed_at")
        end
      end
      filters = {
        completed_at__gte: "2026-10-01T00:00:00-07:00",
        completed_at__lte: "2026-10-30T23:59:59.999999-07:00"
      }
      expect(read_entries(filters)["data"].map { |e| e["id"] }).to eq([entry_id])
      expect(
        read_entries(
          filters.merge(
            completed_at__lte: (inclusive_end - Rational(
              1,
              1_000_000
            )).iso8601(6)
          )
        )["data"]
      ).to be_empty
      expect(
        read_entries({ completed_at__gte: next_midnight.iso8601(6) })["data"].map { |e|
          e["id"]
        }
      ).to eq([next_entry])
    end

    [:completed_at__gte, :completed_at__lte].each do |filter|
      ["not-a-date", "2026-11-05", "2026-11-05T12:00:00", "2026-02-30T00:00:00Z",
       ["2026-11-05T00:00:00Z"]].each do |value|
        it "rejects an invalid/ambiguous #{filter} timestamp #{value.inspect}" do
          get "/entries?#{Rack::Utils.build_nested_query(filter: { filter => value })}"
          expect(last_response.status).to eq(422)
        end
      end
    end

    it "excludes legacy null timestamps from dated completions" do
      # Recreate a pre-migration unknown timestamp only in this rollback-isolated fixture.
      entries.client do |db|
        db.run("ALTER TABLE entries DISABLE TRIGGER trg_set_entry_completed_at")
        begin
          db[:entries].where(id: entry_id).update(completed_at: nil)
        ensure
          db.run("ALTER TABLE entries ENABLE TRIGGER trg_set_entry_completed_at")
        end
      end
      expect(
        read_entries(
          { completed_at__gte: Time.utc(2000).iso8601,
            completed_at__lte: Time.utc(2100).iso8601 }
        )["data"]
      ).to be_empty
    end

    it "continues beyond capped metadata with UUID ordering and no offset drift" do
      ids = Array.new(2004) { UUIDv7.generate }
      entries.client { |db|
        db[:entries].multi_insert(
          ids.map { |id|
            { id:, project_id:, dataset_id:, status: "completed", wf_step: "done" }
          }
        )
      }
      expected = ([entry_id] + ids).sort
      filters = { completed_at__gte: (completed_at - 1).iso8601(6), completed_at__lte: (completed_at + 1).iso8601(6) }
      capped = read_entries(filters, count: true)
      expect(capped.dig("meta", "count")).to eq(1000)
      expect(capped.dig("meta", "more")).to be(true)
      collected = []
      cursor = nil
      loop do
        page = read_entries(filters.merge(cursor ? { id__gt: cursor } : {}))["data"]
        break if page.empty?

        page_ids = page.map { |e| e["id"] }
        expect(page_ids).to eq(page_ids.sort)
        collected.concat(page_ids)
        cursor = page_ids.last
        entries.update!(expected.first, { status: "pending" }) if collected.length == 1000
      end
      expect(collected).to eq(expected)
      expect(collected.uniq.length).to eq(2005)
    end

    context "as a Project Owner", as: :project_owner do
      it "retains repository scope even with an explicit foreign project filter" do
        ProjectMember::Repository.new(system_context).create(
          project_id:,
          account_id: 3,
          role: "project_owner",
          email: "owner@example.com",
          invited_by_id: 1
        )
        foreign_project = Project::Repository.new(system_context).create(
          name: "Foreign",
          organization_id: 2,
          created_by_email: "other@example.com"
        )
        foreign_dataset = Dataset::Repository.new(system_context).create(
          project_id: foreign_project,
          modality: "video",
          labels: [],
          labeling_configuration: {},
          workflow_configuration: {}
        )
        entries.create(project_id: foreign_project, dataset_id: foreign_dataset, status: "completed", wf_step: "done")
        filters = { completed_at__gte: (completed_at - 1).iso8601(6), completed_at__lte: (completed_at + 1).iso8601(6) }
        expect(read_entries(filters)["data"].length).to eq(1)
        expect(
          read_entries(
            filters.merge(
              project_id: foreign_project,
              dataset_id: [foreign_dataset]
            )
          )["data"]
        ).to be_empty
      end
    end
  end
end
