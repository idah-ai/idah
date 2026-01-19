# frozen_string_literal: true

RSpec.describe JobsExpo, type: :exposition, as: :system do
  let(:now) { Time.now.utc }

  let(:job) {
    Jobs::Record.new(
      {
        id: "uuid",
        status: "pending",
        job_class: "MyJob",
        arguments: [],
        priority: 1,
        retry_count: 0,
        scheduled_at: now,
        created_at: now,
        updated_at: now
      }
    )
  }

  it "index" do
    expect_any_instance_of(Jobs::Repository).to receive(:index).and_return([job])

    get "/jobs"

    expect(last_response.status).to eq 200
    body = JSON.parse(last_response.body, symbolize_names: true)
    record = deserialize body

    expect(record[0].id).to eq "uuid"
    expect(record[0].arguments).to eq([])
    expect(record[0].error).to be_nil
    expect(record[0].job_class).to eq "MyJob"
  end

  it "show" do
    expect_any_instance_of(Jobs::Repository).to receive(:find!).and_return(job)

    get "/jobs/uuid"

    expect(last_response.status).to eq 200
    body = JSON.parse(last_response.body, symbolize_names: true)
    record = deserialize body

    expect(record.id).to eq "uuid"
    expect(record.arguments).to eq([])
    expect(record.error).to be_nil
    expect(record.job_class).to eq "MyJob"
  end

  it "destroy" do
    expect_any_instance_of(Jobs::Repository).to receive(:delete).with("uuid").and_return(true)

    delete "/jobs/uuid"

    expect(last_response.status).to eq 204
  end

  it "signal" do
    double("scheduler")
    expect(SCHEDULER).to receive(:signal)

    Verse.publish_resource_event(
      resource_type: "media:jobs",
      resource_id: "uuid",
      event: "created",
      payload: {}
    )
  end
end
