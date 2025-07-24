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
    expect(last_response.body).to eq({ db: "OK", redis: "OK" }.to_json)
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
    expect(last_response.body).to eq({ db: "OK", redis: "FAILED" }.to_json)
  end
end
