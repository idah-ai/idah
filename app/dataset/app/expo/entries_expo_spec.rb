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

  describe "GET /entries/summary" do
    def read_summary(filters = { project_id: project_id })
      get "/entries/summary?#{Rack::Utils.build_nested_query(filter: filters)}"
    end

    it "returns all six exact counts, including non-workflow entries" do
      rows = [
        ["completed", "done", nil], ["pending", "review", nil],
        ["in_progress", "review", 7], ["pending", "annotate", nil],
        ["in_progress", "annotate", 7], ["processing", "start", nil],
        ["errored", "error", nil]
      ].map do |status, step, assigned|
        { id: UUIDv7.generate, project_id: project_id, dataset_id: dataset_id,
          status: status, wf_step: step, assigned_to_id: assigned }
      end
      entries.client { |db| db[:entries].multi_insert(rows) }
      read_summary
      expect(last_response.status).to eq(200), last_response.body
      expect(JSON.parse(last_response.body)).to eq(
        "meta" => { "total" => 7, "completed" => 1, "review" => 2,
                    "annotation" => 2, "reviewing" => 1, "annotating" => 1 }
      )
    end

    it "returns exact counts above the list count cap" do
      rows = Array.new(2005) do
        { id: UUIDv7.generate, project_id: project_id, dataset_id: dataset_id,
          status: "completed", wf_step: "done" }
      end
      entries.client { |db| db[:entries].multi_insert(rows) }
      read_summary
      expect(last_response.status).to eq(200), last_response.body
      expect(JSON.parse(last_response.body).fetch("meta")).to include("total" => 2005, "completed" => 2005)
    end

    ["review", "annotate"].each do |step|
      it "counts more than 1000 assigned Entries in #{step}" do
        entries.client do |db|
          db[:entries].multi_insert(
            Array.new(1001) do
              { id: UUIDv7.generate, project_id: project_id, dataset_id: dataset_id,
                status: "in_progress", wf_step: step, assigned_to_id: 7 }
            end
          )
        end
        read_summary
        expect(last_response.status).to eq(200), last_response.body
        counts = JSON.parse(last_response.body).fetch("meta")
        total_key, assigned_key = step == "review" ? %w[review reviewing] : %w[annotation annotating]
        expect(counts).to include("total" => 1001, total_key => 1001, assigned_key => 1001)
      end
    end

    it "supports selected and focused Dataset scopes and an empty Project" do
      other = Dataset::Repository.new(system_context).create(
        project_id: project_id,
        modality: "video",
        labels: [],
        labeling_configuration: {},
        workflow_configuration: {}
      )
      read_summary
      expect(JSON.parse(last_response.body).fetch("meta").values).to all(eq(0))
      entries.create(project_id: project_id, dataset_id: dataset_id, status: "pending", wf_step: "annotate")
      entries.create(project_id: project_id, dataset_id: other, status: "completed", wf_step: "done")
      read_summary(project_id: project_id, dataset_id: [dataset_id])
      expect(JSON.parse(last_response.body).fetch("meta")).to include("total" => 1, "completed" => 0)
      read_summary(project_id: project_id, dataset_id: [dataset_id, other])
      expect(JSON.parse(last_response.body).fetch("meta")).to include("total" => 2, "completed" => 1)
    end

    [{}, { project_id: "invalid" }, { dataset_id: [""] }, { dataset_id: "bad" },
     { dataset_id: ["bad"] }, { status: "completed" }].each do |invalid|
      it "rejects invalid filters #{invalid.inspect}" do
        filters = invalid.empty? ? {} : { project_id: project_id }.merge(invalid)
        read_summary(filters)
        expect(last_response.status).to eq(422), last_response.body
      end
    end

    it "rejects Dataset IDs belonging to a different Project" do
      foreign_project = Project::Repository.new(system_context).create(
        name: "Foreign", organization_id: 2, created_by_email: "other@example.com"
      )
      foreign_dataset = Dataset::Repository.new(system_context).create(
        project_id: foreign_project,
        modality: "video",
        labels: [],
        labeling_configuration: {},
        workflow_configuration: {}
      )
      read_summary(project_id: project_id, dataset_id: [foreign_dataset])
      expect(last_response.status).to eq(422)
    end

    context "as an Organization Owner", as: :org_owner do
      it "denies summary access to another organization" do
        foreign_project = Project::Repository.new(system_context).create(
          name: "Foreign", organization_id: 2, created_by_email: "other@example.com"
        )
        read_summary(project_id: foreign_project)
        expect(last_response.status).to be_between(403, 404)
        read_summary
        expect(last_response.status).to eq(200), last_response.body
      end
    end

    context "as a Project Owner", as: :project_owner do
      it "denies a foreign Project and permits the owner's Project" do
        read_summary
        expect(last_response.status).to be_between(403, 404)
        ProjectMember::Repository.new(system_context).create(
          project_id: project_id,
          account_id: 3,
          role: "project_owner",
          email: "owner@example.com",
          invited_by_id: 1
        )
        read_summary
        expect(last_response.status).to eq(200), last_response.body
      end
    end
  end

  describe "Dashboard filter schema" do
    [
      {}, { project_id: "invalid" }, { project_id: nil },
      { dataset_id: "not-an-array" },
      { dataset_id: ["invalid"] }, { dataset_id: Array.new(101) { UUIDv7.generate } },
      { unexpected: "value" }
    ].each_with_index do |invalid, index|
      it "rejects invalid filter case #{index + 1} before invoking the Service" do
        expect_any_instance_of(Entry::Service).not_to receive(:summary)
        filter = { project_id: project_id }.merge(invalid)
        filter = {} if invalid.empty?
        get "/entries/summary?#{Rack::Utils.build_nested_query(filter: filter)}"
        expect(last_response.status).to eq(422), last_response.body
        expect(JSON.parse(last_response.body).fetch("errors")).not_to be_empty
      end
    end

    it "rejects an explicit empty Dataset array in the input schema" do
      result = Schemas::ProjectDatasetFilter.validate({ project_id: project_id, dataset_id: [] })
      expect(result.success?).to be(false)
    end

    it "accepts 100 Dataset IDs" do
      ids = Array.new(100) { UUIDv7.generate }
      entries.client do |db|
        db[:datasets].multi_insert(
          ids.map do |id|
            { id: id, project_id: project_id, modality: "video", labeling_configuration: "{}",
              workflow_configuration: "{}" }
          end
        )
      end
      get "/entries/summary?#{Rack::Utils.build_nested_query(filter: { project_id: project_id, dataset_id: ids })}"
      expect(last_response.status).to eq(200), last_response.body
    end
  end

  describe "GET /entries/completion_history" do
    def completion_rows(timestamps, dataset: dataset_id, assigned_to: nil)
      rows = timestamps.map do |timestamp|
        { id: UUIDv7.generate, project_id: project_id, dataset_id: dataset,
          status: "completed", wf_step: "done", assigned_to_id: assigned_to,
          completed_at: timestamp && Time.iso8601(timestamp).utc }
      end
      entries.client do |db|
        # Rollback-isolated historical/legacy fixtures; restore the existing trigger immediately.
        db.run("ALTER TABLE entries DISABLE TRIGGER trg_set_entry_completed_at")
        begin
          db[:entries].multi_insert(rows)
        ensure
          db.run("ALTER TABLE entries ENABLE TRIGGER trg_set_entry_completed_at")
        end
      end
      rows.map { |row| row[:id] }
    end

    def read_completion(from: "2026-11-01", to: "2026-11-30", timezone: "UTC", filter: { project_id: project_id })
      get "/entries/completion_history?#{Rack::Utils.build_nested_query(
        filter: filter,
        from: from,
        to: to,
        tz: timezone
      )}"
      JSON.parse(last_response.body)
    end

    it "aggregates more than 1000 completed Entries and excludes legacy nulls" do
      completion_rows(Array.new(1001, "2026-11-02T12:00:00Z") + [nil])
      body = read_completion
      expect(last_response.status).to eq(200), last_response.body
      expect(body).to eq("meta" => { "timezone" => "UTC", "daily" => { "2026-11-02" => 1001 } })
    end

    it "returns an empty map for a successful empty range" do
      expect(read_completion.dig("meta", "daily")).to eq({})
      expect(last_response.status).to eq(200)
    end

    it "uses inclusive local dates and excludes the next midnight without rounding microseconds" do
      completion_rows(
        ["2026-11-01T16:59:59.999999Z", "2026-11-01T17:00:00Z",
         "2026-11-02T16:59:59.999999Z", "2026-11-02T17:00:00Z"]
      )
      body = read_completion(from: "2026-11-02", to: "2026-11-02", timezone: "Asia/Bangkok")
      expect(last_response.status).to eq(200), last_response.body
      expect(body.dig("meta", "daily")).to eq("2026-11-02" => 2)
    end

    it "interprets stored wall-clock UTC independently of the database session timezone" do
      completion_rows(["2026-11-01T23:30:00Z"])
      entries.client do |db|
        db.run("SET LOCAL TIME ZONE 'Pacific/Honolulu'")
        body = read_completion(from: "2026-11-02", to: "2026-11-02", timezone: "Asia/Bangkok")
        expect(body.dig("meta", "daily")).to eq("2026-11-02" => 1)
      end
    end

    it "handles the 23-hour local day at DST start" do
      completion_rows(
        ["2026-03-08T04:59:59.999999Z", "2026-03-08T05:00:00Z",
         "2026-03-09T03:59:59.999999Z", "2026-03-09T04:00:00Z"]
      )
      body = read_completion(from: "2026-03-08", to: "2026-03-08", timezone: "America/New_York")
      expect(body.dig("meta", "daily")).to eq("2026-03-08" => 2)
    end

    it "counts both repeated hours in the 25-hour DST end day" do
      completion_rows(
        ["2026-11-01T03:59:59.999999Z", "2026-11-01T05:30:00Z",
         "2026-11-01T06:30:00Z", "2026-11-02T04:59:59.999999Z", "2026-11-02T05:00:00Z"]
      )
      body = read_completion(from: "2026-11-01", to: "2026-11-01", timezone: "America/New_York")
      expect(body.dig("meta", "daily")).to eq("2026-11-01" => 3)
    end

    it "supports a 366-day leap year and half-hour timezone across year end" do
      completion_rows(["2024-02-29T12:00:00Z", "2023-12-31T18:30:00Z"])
      body = read_completion(from: "2024-01-01", to: "2024-12-31", timezone: "Asia/Kolkata")
      expect(last_response.status).to eq(200), last_response.body
      expect(body.dig("meta", "daily")).to eq("2024-01-01" => 1, "2024-02-29" => 1)
    end

    [{ from: "2024-01-01", to: "2025-01-01" }, { from: "2026-2-1" },
     { from: "2026-02-30" }, { from: "2026-12-01", to: "2026-11-01" },
     { timezone: "Invalid/Timezone" }, { from: "2026-11-01T00:00:00Z" }].each do |invalid|
      it "rejects invalid completion range #{invalid}" do
        read_completion(**invalid)
        expect(last_response.status).to eq(422), last_response.body
      end
    end

    it "preserves reopen/recomplete lifecycle and counts only currently completed Entries" do
      id = completion_rows(["2026-11-02T12:00:00Z"]).first
      entries.update!(id, { status: "pending" })
      expect(read_completion.dig("meta", "daily")).to eq({})
      expect(entries.find!(id).completed_at).to be_nil
      entries.update!(id, { status: "completed" })
      day = entries.find!(id).completed_at.utc.to_date.iso8601
      expect(read_completion(from: day, to: day).dig("meta", "daily")).to eq(day => 1)
    end

    it "filters selected and focused Datasets and rejects cross-project IDs" do
      other = Dataset::Repository.new(system_context).create(
        project_id: project_id,
        modality: "video",
        labels: [],
        labeling_configuration: {},
        workflow_configuration: {}
      )
      completion_rows(["2026-11-02T12:00:00Z"])
      completion_rows(["2026-11-03T12:00:00Z"], dataset: other)
      expect(read_completion(filter: { project_id: project_id, dataset_id: [other] }).dig("meta", "daily"))
        .to eq("2026-11-03" => 1)
      expect(
        read_completion(filter: { project_id: project_id, dataset_id: [dataset_id, other] }).dig(
          "meta",
          "daily"
        ).values.sum
      )
        .to eq(2)
      read_completion(filter: { project_id: UUIDv7.generate, dataset_id: [dataset_id] })
      expect(last_response.status).to be_between(403, 404)
    end

    it "enforces Project Owner access", as: :project_owner do
      read_completion
      expect(last_response.status).to be_between(403, 404)
      ProjectMember::Repository.new(system_context).create(
        project_id: project_id,
        account_id: 3,
        role: "project_owner",
        email: "owner@example.com",
        invited_by_id: 1
      )
      read_completion
      expect(last_response.status).to eq(200), last_response.body
    end

    it "uses the Entry read scope rather than a system repository", as: :annotator do
      ProjectMember::Repository.new(system_context).create(
        project_id: project_id,
        account_id: 4,
        role: "annotator",
        email: "annotator@example.com",
        invited_by_id: 1
      )
      completion_rows(["2026-11-02T12:00:00Z"], assigned_to: 4)
      completion_rows(["2026-11-02T12:00:00Z"], assigned_to: 5)
      expect(read_completion.dig("meta", "daily")).to eq("2026-11-02" => 1)
    end
  end

  describe "offset-aware Entry pagination" do
    [999, 1000, 1001, 2005].each do |total|
      it "keeps metadata and rows correct for #{total} Entries" do
        ids = Array.new(total) { UUIDv7.generate }.sort
        entries.client do |db|
          db[:entries].multi_insert(
            ids.map do |id|
              { id: id, project_id: project_id, dataset_id: dataset_id, status: "pending",
                wf_step: "annotate" }
            end
          )
        end
        final = (total / 10.0).ceil
        [99, 100, 101, final, final + 1].uniq.each do |page|
          get "/entries?#{Rack::Utils.build_nested_query(
            filter: { project_id: project_id }, sort: "id", page: { number: page, size: 10 }, count: true
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
  end

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

  describe "Entry read scope" do
    let!(:entry_id) { entries.create(project_id:, dataset_id:, status: "completed", wf_step: "done") }

    def read_entries(extra = {})
      params = { filter: { project_id:, dataset_id: [dataset_id], status__in: ["completed"] }.merge(extra),
                 sort: "id", page: { number: 1, size: 1000 }, count: false,
                 fields: { Resource::Dataset::Entries => ["id", "completed_at"] } }
      get "/entries?#{Rack::Utils.build_nested_query(params)}"
      expect(last_response.status).to eq(200), last_response.body
      JSON.parse(last_response.body)
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
        expect(read_entries["data"].map { |entry| entry["id"] }).to eq([entry_id])
        expect(
          read_entries(
            project_id: foreign_project,
            dataset_id: [foreign_dataset]
          )["data"]
        ).to be_empty
      end
    end
  end
end
