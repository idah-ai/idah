# frozen_string_literal: true

RSpec.describe HealthcheckExpo, type: :exposition do
  it "is successful when all services are up" do
    expect(HealthcheckService).to receive(:run).and_return(
      HealthcheckService::Result.new(
        success?: true,
        status: {
          "db" => "OK",
          "redis" => "OK"
        }
      )
    )

    get "/healthcheck"

    expect(last_response.status).to eq 200
    expect(JSON.parse(last_response.body)).to eq(
      "version" => IdahVersion.number,
      "revision" => IdahVersion.revision,
      "db" => "OK",
      "redis" => "OK"
    )
  end

  it "is a failure when a service is down" do
    expect(HealthcheckService).to receive(:run).and_return(
      HealthcheckService::Result.new(
        success?: false,
        status: {
          "db" => "OK",
          "redis" => "FAILED"
        }
      )
    )

    get "/healthcheck"

    expect(last_response.status).to eq 500
    expect(JSON.parse(last_response.body)).to eq(
      "version" => IdahVersion.number,
      "revision" => IdahVersion.revision,
      "db" => "OK",
      "redis" => "FAILED"
    )
  end
end
