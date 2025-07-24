# frozen_string_literal: true

RSpec.describe HealthcheckService, type: :service, as: :system do
  describe ".run" do
    context "when all services are healthy" do
      it "returns a successful result" do
        result = described_class.run
        expect(result.success?).to be true
        expect(result.status).to eq(
          {
            "sequel" => "OK",
            "redis" => "OK"
          }
        )
      end
    end

    context "when a service is unhealthy" do
      before do
        db = double("db")
        allow(db).to receive(:execute).and_raise(
          StandardError, "Database error"
        )

        allow_any_instance_of(
          Verse::Sequel::Plugin
        ).to receive(:client).and_yield(db)
      end

      it "returns an unsuccessful result" do
        result = described_class.run
        expect(result.success?).to be false
        expect(result.status).to eq(
          {
            "sequel" => "FAILED",
            "redis" => "OK"
          }
        )
      end
    end

    context "when sequel plugin is not defined" do
      before do
        hide_const("Verse::Sequel::Plugin")
      end

      it "returns a successful result without checking sequel" do
        result = described_class.run
        expect(result.success?).to be true
        expect(result.status).to eq({ "redis" => "OK" })
      end
    end

    context "when redis plugin is not defined" do
      before do
        hide_const("Verse::Redis::Plugin")
      end

      it "returns a successful result without checking redis" do
        result = described_class.run
        expect(result.success?).to be true
        expect(result.status).to eq({ "sequel" => "OK" })
      end
    end

    context "when an unexpected error occurs" do
      before do
        allow(Verse::Plugin).to receive(:all).and_raise(RuntimeError, "some error")
        allow(Verse.logger).to receive(:error)
      end

      it "returns an unsuccessful result and logs the error" do
        result = described_class.run
        expect(result.success?).to be false
        expect(result.status).to eq({})
        expect(Verse.logger).to have_received(:error).with("Healthcheck failed: some error")
      end
    end
  end
end
