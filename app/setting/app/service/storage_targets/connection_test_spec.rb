# frozen_string_literal: true

require "spec_helper"
require "aws-sdk-s3"

RSpec.describe StorageTargets::ConnectionTest do
  let(:target) do
    {
      endpoint: "https://s3.example.com",
      region: "eu-west-1",
      bucket: "customer-bucket",
      prefix: "/acme/",
      access_key_id: "AKIAEXAMPLE",
      secret_access_key: "LEAK-CANARY-123"
    }
  end

  let(:client) do
    Aws::S3::Client.new(stub_responses: true).tap do |client|
      client.stub_responses(:get_object, { body: described_class::PROBE_CONTENT })
    end
  end

  subject(:test) { described_class.new(client_factory: ->(_options) { client }) }

  it "puts, reads back and deletes a probe object under the target's prefix" do
    expect(test.call(**target)).to be_nil

    operations = client.api_requests.map { |request| [request[:operation_name], request[:params][:key]] }
    expect(operations.map(&:first)).to eq(%i[put_object get_object delete_object])
    expect(operations.map(&:last)).to all(start_with("acme/.idah-probe-"))
    expect(client.api_requests.map { |request| request[:params][:bucket] }.uniq).to eq(["customer-bucket"])
  end

  it "builds the client with short timeouts and no retries" do
    options = nil
    described_class.new(client_factory: ->(opts) { options = opts; client }).call(**target)

    expect(options).to include(
      endpoint: "https://s3.example.com",
      region: "eu-west-1",
      access_key_id: "AKIAEXAMPLE",
      force_path_style: false,
      http_open_timeout: 5,
      http_read_timeout: 5,
      retry_limit: 0
    )
  end

  it "addresses the bucket by path when told to, as MinIO or Ceph need" do
    options = nil
    described_class.new(client_factory: ->(opts) { options = opts; client }).call(**target, path_style: true)

    expect(options[:force_path_style]).to be(true)
  end

  it "uses a placeholder region when the target has none, as S3-compatible stores ignore it" do
    options = nil
    described_class.new(client_factory: ->(opts) { options = opts; client }).call(**target, region: nil)

    expect(options[:region]).to eq("us-east-1")
  end

  {
    "AccessDenied" => "access_denied",
    "InvalidAccessKeyId" => "access_denied",
    "SignatureDoesNotMatch" => "access_denied",
    "NoSuchBucket" => "bucket_not_found",
    "InternalError" => "connection_failed"
  }.each do |code, result|
    it "reports #{result} when S3 answers #{code}" do
      client.stub_responses(:put_object, code)

      expect(test.call(**target)).to eq(result)
    end
  end

  it "reports unreachable when the endpoint can't be reached" do
    client.stub_responses(:put_object, Seahorse::Client::NetworkingError.new(SocketError.new("getaddrinfo")))

    expect(test.call(**target)).to eq("unreachable")
  end

  it "reports a probe that reads back different content" do
    client.stub_responses(:get_object, { body: "something else" })

    expect(test.call(**target)).to eq("connection_failed")
  end

  it "refuses an http endpoint outside development and test" do
    stub_const("ENV", ENV.to_h.merge("APP_ENVIRONMENT" => "production"))

    expect(test.call(**target, endpoint: "http://s3.example.com")).to eq("https_required")
    expect(client.api_requests).to be_empty
  end

  it "refuses an endpoint that isn't a URL" do
    expect(test.call(**target, endpoint: "not a url")).to eq("invalid_endpoint")
  end
end
