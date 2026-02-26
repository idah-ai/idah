# frozen_string_literal: true

RSpec.describe JobsExpo, type: :exposition, as: :system do
  let(:now) { Time.now.utc }

  let(:job_id) { "019bba87-650e-74e8-a68a-bc49bfff2527" }
  let(:job) {
    Jobs::Record.new(
      {
        id: job_id,
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

    expect(record[0].id).to eq job_id
    expect(record[0].arguments).to eq([])
    expect(record[0].error).to be_nil
    expect(record[0].job_class).to eq "MyJob"
  end

  it "show" do
    expect_any_instance_of(Jobs::Repository).to receive(:find!).and_return(job)

    get "/jobs/#{job_id}"

    expect(last_response.status).to eq 200
    body = JSON.parse(last_response.body, symbolize_names: true)
    record = deserialize body

    expect(record.id).to eq job_id
    expect(record.arguments).to eq([])
    expect(record.error).to be_nil
    expect(record.job_class).to eq "MyJob"
  end

  it "destroy" do
    expect_any_instance_of(Jobs::Repository).to receive(:delete).with(job_id).and_return(true)

    delete "/jobs/#{job_id}"

    expect(last_response.status).to eq 204
  end

  it "signal" do
    expect(SCHEDULER).to receive(:signal)

    Verse.publish_resource_event(
      resource_type: "sync:jobs",
      resource_id: job_id,
      event: "created",
      payload: {}
    )
  end
end
