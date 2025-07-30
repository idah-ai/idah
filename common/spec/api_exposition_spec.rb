# frozen_string_literal: true

require "rspec"
require "webmock/rspec"
require "json"
require "tempfile"
require_relative "../lib/api"
require_relative "../lib/api/service"
require_relative "../lib/api/exposition"
require_relative "../lib/api/multipart_stream"

RSpec.describe Api::Exposition do
  include WebMock::API

  let(:api) { Api[:test] }
  let(:service) { Api::Service.new(api, :test_service) }
  let(:exposition) { described_class.new(api, :test_exposition) }

  before do
    WebMock.enable!
    api.instance_variable_set(:@base_url, "https://api.example.com")
    allow(service).to receive(:parent).and_return(api)
    allow(api).to receive(:base_url).and_return("https://api.example.com")
  end

  after do
    WebMock.disable!
  end

  describe "#initialize" do
    it "sets parent and name correctly" do
      expect(exposition.parent).to eq(api)
      expect(exposition.name).to eq(:test_exposition)
    end
  end

  describe "HTTP verb methods" do
    let(:test_url) { "https://api.example.com/test" }

    describe "#get" do
      it "makes a GET request with query parameters" do
        stub_request(:get, test_url)
          .with(query: { param1: "value1", param2: "value2" })
          .to_return(status: 200, body: '{"success": true}')

        response = exposition.get("/test", params: { param1: "value1", param2: "value2" })

        expect(response.code).to eq("200")
        expect(JSON.parse(response.body)).to eq({ "success" => true })
      end

      it "makes a GET request with headers" do
        stub_request(:get, test_url)
          .with(headers: { "Authorization" => "Bearer token123" })
          .to_return(status: 200, body: '{"success": true}')

        response = exposition.get("/test", headers: { "Authorization" => "Bearer token123" })

        expect(response.code).to eq("200")
      end

      it "handles path parameters" do
        stub_request(:get, "https://api.example.com/users/123")
          .to_return(status: 200, body: '{"id": 123}')

        response = exposition.get("/users/:id", params: { id: 123 })

        expect(response.code).to eq("200")
        expect(JSON.parse(response.body)).to eq({ "id" => 123 })
      end

      it "raises error for missing path parameters" do
        expect {
          exposition.get("/users/:id", params: {})
        }.to raise_error("Missing parameter: id")
      end
    end

    describe "#post" do
      it "makes a POST request with JSON body" do
        stub_request(:post, test_url)
          .with(
            body: '{"name":"test","value":"data"}',
            headers: { "Content-Type" => "application/json" }
          )
          .to_return(status: 201, body: '{"created": true}')

        response = exposition.post("/test", params: { name: "test", value: "data" })

        expect(response.code).to eq("201")
        expect(JSON.parse(response.body)).to eq({ "created" => true })
      end

      it "makes a POST request with form data" do
        stub_request(:post, test_url)
          .with(
            body: "name=test&value=data",
            headers: { "Content-Type" => "application/x-www-form-urlencoded" }
          )
          .to_return(status: 201, body: '{"created": true}')

        response = exposition.post(
          "/test",
          headers: { "Content-Type" => "application/x-www-form-urlencoded" },
          params: { name: "test", value: "data" }
        )

        expect(response.code).to eq("201")
      end

      it "makes a POST request with explicit JSON content type" do
        stub_request(:post, test_url)
          .with(
            body: '{"name":"test","value":"data"}',
            headers: { "Content-Type" => "application/json" }
          )
          .to_return(status: 201, body: '{"created": true}')

        response = exposition.post(
          "/test",
          headers: { "Content-Type" => "application/json" },
          params: { name: "test", value: "data" }
        )

        expect(response.code).to eq("201")
      end
    end

    describe "#put" do
      it "makes a PUT request with JSON body" do
        stub_request(:put, test_url)
          .with(
            body: '{"name":"updated","value":"data"}',
            headers: { "Content-Type" => "application/json" }
          )
          .to_return(status: 200, body: '{"updated": true}')

        response = exposition.put("/test", params: { name: "updated", value: "data" })

        expect(response.code).to eq("200")
        expect(JSON.parse(response.body)).to eq({ "updated" => true })
      end
    end

    describe "#patch" do
      it "makes a PATCH request with JSON body" do
        stub_request(:patch, test_url)
          .with(
            body: '{"value":"patched"}',
            headers: { "Content-Type" => "application/json" }
          )
          .to_return(status: 200, body: '{"patched": true}')

        response = exposition.patch("/test", params: { value: "patched" })

        expect(response.code).to eq("200")
        expect(JSON.parse(response.body)).to eq({ "patched" => true })
      end
    end

    describe "#delete" do
      it "makes a DELETE request" do
        stub_request(:delete, test_url)
          .to_return(status: 204, body: "")

        response = exposition.delete("/test")

        expect(response.code).to eq("204")
      end

      it "makes a DELETE request with query parameters" do
        stub_request(:delete, test_url)
          .with(query: { force: "true" })
          .to_return(status: 204, body: "")

        response = exposition.delete("/test", params: { force: "true" })

        expect(response.code).to eq("204")
      end
    end
  end

  describe "multipart form data" do
    let(:test_url) { "https://api.example.com/upload" }

    it "handles file uploads with multipart/form-data" do
      # Create a temporary file for testing
      temp_file = Tempfile.new(["test", ".txt"])
      temp_file.write("test file content")
      temp_file.rewind

      # Mock file-like object
      file_mock = double("file")
      allow(file_mock).to receive(:read).and_return("test file content")
      allow(file_mock).to receive(:size).and_return(17)
      allow(file_mock).to receive(:respond_to?).with(:read).and_return(true)
      allow(file_mock).to receive(:respond_to?).with(:size).and_return(true)
      allow(file_mock).to receive(:respond_to?).with(:stat).and_return(false)
      allow(file_mock).to receive(:respond_to?).with(:original_filename).and_return(false)
      allow(file_mock).to receive(:respond_to?).with(:path).and_return(true)
      allow(file_mock).to receive(:respond_to?).with(:content_type).and_return(false)
      allow(file_mock).to receive(:path).and_return("test.txt")

      stub_request(:post, test_url)
        .with(headers: { "Content-Type" => %r{multipart/form-data} })
        .to_return(status: 200, body: '{"uploaded": true}')

      response = exposition.post(
        "/upload",
        headers: { "Content-Type" => "multipart/form-data" },
        params: {
          file: file_mock,
          description: "Test file upload"
        }
      )

      expect(response.code).to eq("200")
      expect(JSON.parse(response.body)).to eq({ "uploaded" => true })

      temp_file.close
      temp_file.unlink
    end

    it "handles Rails-style uploaded files" do
      # Mock Rails uploaded file
      uploaded_file = double("uploaded_file")
      allow(uploaded_file).to receive(:read).and_return("rails file content")
      allow(uploaded_file).to receive(:size).and_return(18)
      allow(uploaded_file).to receive(:respond_to?).with(:read).and_return(true)
      allow(uploaded_file).to receive(:respond_to?).with(:size).and_return(true)
      allow(uploaded_file).to receive(:respond_to?).with(:stat).and_return(false)
      allow(uploaded_file).to receive(:respond_to?).with(:original_filename).and_return(true)
      allow(uploaded_file).to receive(:respond_to?).with(:content_type).and_return(true)
      allow(uploaded_file).to receive(:original_filename).and_return("rails_file.txt")
      allow(uploaded_file).to receive(:content_type).and_return("text/plain")

      stub_request(:post, test_url)
        .with(headers: { "Content-Type" => %r{multipart/form-data} })
        .to_return(status: 200, body: '{"uploaded": true}')

      response = exposition.post(
        "/upload",
        headers: { "Content-Type" => "multipart/form-data" },
        params: {
          file: uploaded_file,
          title: "Rails upload"
        }
      )

      expect(response.code).to eq("200")
    end

    it "calculates multipart content length correctly" do
      file_mock = double("file")
      allow(file_mock).to receive(:respond_to?).with(:read).and_return(true)
      allow(file_mock).to receive(:respond_to?).with(:size).and_return(true)
      allow(file_mock).to receive(:respond_to?).with(:stat).and_return(false)
      allow(file_mock).to receive(:respond_to?).with(:original_filename).and_return(false)
      allow(file_mock).to receive(:respond_to?).with(:path).and_return(true)
      allow(file_mock).to receive(:respond_to?).with(:content_type).and_return(false)
      allow(file_mock).to receive(:path).and_return("test.txt")
      allow(file_mock).to receive(:size).and_return(10)

      params = { file: file_mock, name: "test" }
      boundary = "test-boundary"

      length = exposition.send(:calculate_multipart_length, params, boundary)

      expect(length).to be > 0
      expect(length).to be_a(Integer)
    end
  end

  describe "authentication handling" do
    let(:test_url) { "https://api.example.com/protected" }

    it "calls parent auth method when auth option is provided" do
      expect(api).to receive(:auth).with("token123", headers: {})

      stub_request(:get, test_url)
        .to_return(status: 200, body: '{"authenticated": true}')

      response = exposition.get("/protected", options: { auth: "token123" })

      expect(response.code).to eq("200")
    end

    it "does not call auth when no auth option provided" do
      expect(api).not_to receive(:auth)

      stub_request(:get, test_url)
        .to_return(status: 200, body: '{"public": true}')

      response = exposition.get("/protected")

      expect(response.code).to eq("200")
    end
  end

  describe "HTTPS handling" do
    it "uses SSL for HTTPS URLs" do
      api.instance_variable_set(:@base_url, "https://secure.example.com")
      allow(api).to receive(:base_url).and_return("https://secure.example.com")

      stub_request(:get, "https://secure.example.com/secure")
        .to_return(status: 200, body: '{"secure": true}')

      # Mock Net::HTTP to verify SSL usage
      http_mock = double("http")
      allow(Net::HTTP).to receive(:new).and_return(http_mock)
      allow(http_mock).to receive(:use_ssl=).with(true)
      allow(http_mock).to receive(:request).and_return(
        double("response", code: "200", body: '{"secure": true}')
      )

      exposition.get("/secure")

      expect(http_mock).to have_received(:use_ssl=).with(true)
    end

    it "does not use SSL for HTTP URLs" do
      api.instance_variable_set(:@base_url, "http://insecure.example.com")
      allow(api).to receive(:base_url).and_return("http://insecure.example.com")

      stub_request(:get, "http://insecure.example.com/insecure")
        .to_return(status: 200, body: '{"secure": false}')

      # Mock Net::HTTP to verify SSL usage
      http_mock = double("http")
      allow(Net::HTTP).to receive(:new).and_return(http_mock)
      allow(http_mock).to receive(:use_ssl=).with(false)
      allow(http_mock).to receive(:request).and_return(
        double("response", code: "200", body: '{"secure": false}')
      )

      exposition.get("/insecure")

      expect(http_mock).to have_received(:use_ssl=).with(false)
    end
  end

  describe "error handling" do
    it "raises error when base URL is not configured" do
      allow(api).to receive(:base_url).and_return(nil)

      expect {
        exposition.get("/test")
      }.to raise_error("Base URL not configured")
    end

    it "handles network errors gracefully" do
      stub_request(:get, "https://api.example.com/error")
        .to_raise(StandardError.new("Network error"))

      expect {
        exposition.get("/error")
      }.to raise_error(StandardError, "Network error")
    end
  end

  describe "#register" do
    it "allows registering custom methods" do
      exposition.register(:custom_method) do
        "custom result"
      end

      expect(exposition.custom_method).to eq("custom result")
    end
  end

  describe "URI building" do
    it "properly joins base URL with path" do
      uri = exposition.send(:build_uri, "/test/path", :get, {}, {})
      expect(uri.to_s).to eq("https://api.example.com/test/path")
    end

    it "handles query parameters for GET requests" do
      uri = exposition.send(:build_uri, "/test", :get, { param1: "value1", param2: "value2" }, {})
      expect(uri.query).to include("param1=value1")
      expect(uri.query).to include("param2=value2")
    end

    it "handles query parameters for DELETE requests" do
      uri = exposition.send(:build_uri, "/test", :delete, { force: "true" }, {})
      expect(uri.query).to include("force=true")
    end

    it "does not add query parameters for POST requests" do
      uri = exposition.send(:build_uri, "/test", :post, { param1: "value1" }, {})
      expect(uri.query).to be_nil
    end

    it "properly escapes query parameters" do
      uri = exposition.send(:build_uri, "/test", :get, { "special chars" => "value with spaces" }, {})
      expect(uri.query).to include("special%20chars=value%20with%20spaces")
    end
  end

  describe "request creation" do
    let(:uri) { URI("https://api.example.com/test") }

    it "creates correct request class for each HTTP method" do
      get_request = exposition.send(:create_request, :get, uri, {}, {})
      expect(get_request).to be_a(Net::HTTP::Get)

      post_request = exposition.send(:create_request, :post, uri, {}, {})
      expect(post_request).to be_a(Net::HTTP::Post)

      put_request = exposition.send(:create_request, :put, uri, {}, {})
      expect(put_request).to be_a(Net::HTTP::Put)

      patch_request = exposition.send(:create_request, :patch, uri, {}, {})
      expect(patch_request).to be_a(Net::HTTP::Patch)

      delete_request = exposition.send(:create_request, :delete, uri, {}, {})
      expect(delete_request).to be_a(Net::HTTP::Delete)
    end

    it "sets headers correctly" do
      headers = { "Authorization" => "Bearer token", "Custom-Header" => "value" }
      request = exposition.send(:create_request, :get, uri, headers, {})

      expect(request["Authorization"]).to eq("Bearer token")
      expect(request["Custom-Header"]).to eq("value")
    end
  end

  describe "file helper methods" do
    it "identifies file-like objects correctly" do
      file_mock = double("file")
      allow(file_mock).to receive(:respond_to?).with(:read).and_return(true)
      allow(file_mock).to receive(:respond_to?).with(:size).and_return(true)

      expect(exposition.send(:file_like?, file_mock)).to be true

      non_file = "string"
      expect(exposition.send(:file_like?, non_file)).to be false
    end

    it "gets filename from different file types" do
      # Rails uploaded file
      rails_file = double("rails_file")
      allow(rails_file).to receive(:respond_to?).with(:original_filename).and_return(true)
      allow(rails_file).to receive(:original_filename).and_return("rails.txt")
      expect(exposition.send(:get_filename, rails_file)).to eq("rails.txt")

      # Regular file
      regular_file = double("regular_file")
      allow(regular_file).to receive(:respond_to?).with(:original_filename).and_return(false)
      allow(regular_file).to receive(:respond_to?).with(:path).and_return(true)
      allow(regular_file).to receive(:path).and_return("/path/to/file.txt")
      expect(exposition.send(:get_filename, regular_file)).to eq("file.txt")

      # Unknown file type
      unknown_file = double("unknown_file")
      allow(unknown_file).to receive(:respond_to?).with(:original_filename).and_return(false)
      allow(unknown_file).to receive(:respond_to?).with(:path).and_return(false)
      expect(exposition.send(:get_filename, unknown_file)).to eq("file")
    end

    it "gets content type from different file types" do
      # Rails uploaded file
      rails_file = double("rails_file")
      allow(rails_file).to receive(:respond_to?).with(:content_type).and_return(true)
      allow(rails_file).to receive(:content_type).and_return("text/plain")
      expect(exposition.send(:get_content_type, rails_file)).to eq("text/plain")

      # Unknown file type
      unknown_file = double("unknown_file")
      allow(unknown_file).to receive(:respond_to?).with(:content_type).and_return(false)
      expect(exposition.send(:get_content_type, unknown_file)).to eq("application/octet-stream")
    end

    it "gets file size from different file types" do
      # File with size method
      file_with_size = double("file_with_size")
      allow(file_with_size).to receive(:respond_to?).with(:size).and_return(true)
      allow(file_with_size).to receive(:size).and_return(1024)
      expect(exposition.send(:get_file_size, file_with_size)).to eq(1024)

      # File with stat method
      file_with_stat = double("file_with_stat")
      stat_mock = double("stat")
      allow(stat_mock).to receive(:size).and_return(2048)
      allow(file_with_stat).to receive(:respond_to?).with(:size).and_return(false)
      allow(file_with_stat).to receive(:respond_to?).with(:stat).and_return(true)
      allow(file_with_stat).to receive(:stat).and_return(stat_mock)
      expect(exposition.send(:get_file_size, file_with_stat)).to eq(2048)

      # File without size info
      unknown_file = double("unknown_file")
      allow(unknown_file).to receive(:respond_to?).with(:size).and_return(false)
      allow(unknown_file).to receive(:respond_to?).with(:stat).and_return(false)
      expect {
        exposition.send(:get_file_size, unknown_file)
      }.to raise_error("Cannot determine file size for streaming")
    end
  end
end
