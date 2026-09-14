# frozen_string_literal: true

require "sinatra/base"
require "json"
require "net/http"
require "uri"

class MockQcApp < Sinatra::Base
  # Allow requests from any host (Rack::Protection blocks host.docker.internal)
  set :host_authorization, { permitted_hosts: [] }
  set :protection, except: :host_authorization

  # In-memory store for received annotation data and JWT token
  set :store, {}
  set :jwt_token, nil
  set :idah_api_key, ENV["IDAH_API_KEY"]
  set :idah_url, ENV["IDAH_URL"] || "https://idah.localhost:8443"

  # Authenticate with IDAH on startup using the configured API key.
  # After login, the JWT token is sent with callback requests.
  configure do
    api_key = settings.idah_api_key
    if api_key
      begin
        uri = URI.parse("#{settings.idah_url}/api/v1/iam/auth/api/login")
        http = Net::HTTP.new(uri.host, uri.port)
        http.use_ssl = (uri.scheme == "https")
        http.verify_mode = OpenSSL::SSL::VERIFY_NONE if http.use_ssl?

        req = Net::HTTP::Post.new(uri.request_uri)
        req.body = { api_key: api_key }.to_json
        req["Content-Type"] = "application/json"

        res = http.request(req)

        if res.code.to_i == 200
          body = JSON.parse(res.body)
          token = body&.dig("meta", "token")
          settings.jwt_token = token
          puts "[MockQC] Authenticated with IDAH. Token: #{token&.slice(0, 30)}..."
        else
          puts "[MockQC] WARNING: Auth failed: #{res.code} #{res.body&.slice(0, 100)}"
        end
      rescue StandardError => e
        puts "[MockQC] WARNING: Auth error: #{e.message}"
      end
    else
      puts "[MockQC] WARNING: No IDAH_API_KEY set. Callbacks won't be authenticated."
    end
  end

  # Enable CORS for local development
  before do
    headers "Access-Control-Allow-Origin"  => "*",
            "Access-Control-Allow-Methods" => "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers" => "Content-Type, Authorization"
  end

  options "*" do
    200
  end

  # Receive annotation data from IDAH (outbound call from QcClient)
  post "/" do
    data = JSON.parse(request.body.read)

    settings.store[:last] = data
    settings.store[:received_at] = Time.now.iso8601

    logger.info "[MockQC] Received entry #{data['entry_id']} with #{data['annotations']&.size || 0} annotations"

    content_type :json
    { status: "received", entry_id: data["entry_id"] }.to_json
  end

  # Check the stored data
  get "/status" do
    content_type :json
    {
      has_data: !settings.store[:last].nil?,
      entry_id: settings.store[:last]&.dig("entry_id"),
      received_at: settings.store[:received_at],
      annotations_count: settings.store[:last]&.dig("annotations")&.size || 0
    }.to_json
  end

  # Simulate the callback to IDAH.
  # The QC app modifies annotations (adds qc_score, qc_checked metadata)
  # and creates a note feed with QC feedback.
  post "/trigger-callback" do
    data = settings.store[:last]
    halt 400, json({ error: "No data received yet. POST to / first." }) unless data

    callback_url = data["qc_callback_url"]
    halt 400, json({ error: "No qc_callback_url in stored data" }) unless callback_url
    puts "[MockQC] Triggering callback to #{data}"

    # Build the callback payload with modified annotations and notes
    annotations = (data["annotations"] || []).map do |annotation|
      # Build a new metadata hash preserving existing ones
      puts "[MockQC] Processing annotation #{annotation}"
      existing_meta = annotation["metadata"] || {}
      new_meta = existing_meta.merge({
        "qc_score"   => rand(0.0..1.0).round(2),
        "qc_checked" => true
      })

      # Build a clean annotation hash
      {
        "id"         => annotation["id"],
        "dimensions" => annotation["dimensions"],
        "annotation" => annotation["annotation"],
        "metadata"   => new_meta
      }
    end

    payload = {
      data: {
        attributes: {
          token: data["callback_token"],
          annotations: annotations,
          notes: [
            {
              content_md: "QC check completed. Score: 'N/A'}",
              annotation_id: nil,
              anchor_type: "entry",
              position: nil
            }
          ]
        }
      }
    }.to_json

    # Call back to IDAH with JWT authentication (if available)
    uri = URI.parse(callback_url)
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = (uri.scheme == "https")
    http.verify_mode = OpenSSL::SSL::VERIFY_NONE if http.use_ssl?

    request = Net::HTTP::Post.new(uri.request_uri)
    request.body = payload
    request["Content-Type"] = "application/json"

    # Add JWT authentication if we have a token
    if settings.jwt_token
      request["Authorization"] = "Bearer #{settings.jwt_token}"
    end

    response = http.request(request)

    logger.info "[MockQC] Called back to #{callback_url} — response: #{response.code}"

    content_type :json
    {
      status: "callback_sent",
      response_code: response.code.to_i,
      entry_id: data["entry_id"]
    }.to_json
  end

  # Health check
  get "/health" do
    content_type :json
    { status: "ok" }.to_json
  end

  private

  def json(hash)
    hash.to_json
  end
end