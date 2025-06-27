# frozen_string_literal: true

RSpec.describe JobsExpo, type: :exposition do
  let(:job) {
    Jobs::Record.new({
      id: 1,
      status: "pending",
      job_class: "MyJob",
      arguments: [],
      priority: 1,
      retry_count: 0,
      scheduled_at: Time.now,
      created_at: Time.now,
      updated_at: Time.now
     })
  }

  it "index" do
    expect_any_instance_of(Jobs::Repository).to receive(:index).and_return([job])

    get "/jobs"

    expect(last_response.status).to eq 200
    body = JSON.parse(last_response.body, symbolize_names: true)
    expect(body.dig(:data, 0, :attributes)).to eq(
      job.to_h.except(:id, :arguments)
    )
  end

  it "show" do
    expect_any_instance_of(Jobs::Repository).to receive(:find).with(1).and_return(job)

    get "/jobs/1"

    expect(last_response.status).to eq 200
    body = JSON.parse(last_response.body, symbolize_names: true)
    expect(body.dig(:data, :attributes)).to eq(
      job.to_h.except(:id, :arguments)
    )
  end

  it "destroy" do
    expect_any_instance_of(Jobs::Repository).to receive(:delete).with(1).and_return(true)

    delete "/jobs/1"

    expect(last_response.status).to eq 204
  end

  it "signal" do
    scheduler = double("scheduler")
    expect(Jobs::Scheduler).to receive(:instance).and_return(scheduler)
    expect(scheduler).to receive(:signal)

    Verse.publish_resource_event(
      resource_type: "medias:jobs",
      resource_id: 1,
      event: "created",
      payload: {}
    )
  end
end
