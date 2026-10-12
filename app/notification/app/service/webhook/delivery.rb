# frozen_string_literal: true

require "net/http"
require "openssl"

module Webhook
  # Builds, signs and sends webhook requests.
  #
  # Receivers verify `X-Signature` = "sha256=" + hex HMAC-SHA256 of
  # "<X-Timestamp>.<raw body>" with the webhook secret, and can use the
  # body's `nonce` (kept across retries) to drop duplicates.
  module Delivery
    extend self

    TIMEOUT = 5
    MAX_RESPONSE_BYTES = 4096

    def envelope(event:, resource_id:, payload:)
      {
        nonce: (Time.now.to_i << 32) | SecureRandom.random_number(1 << 32),
        event:,
        resource_id:,
        payload:
      }
    end

    # Returns [http_code, response body truncated to 4 KB]. Raises on network
    # errors and when the URL no longer resolves to a public address.
    def post(webhook, body)
      address = UrlValidator.validate!(webhook.url)
      uri = URI.parse(webhook.url)
      json = body.to_json
      timestamp = Time.now.to_i.to_s

      request = Net::HTTP::Post.new(uri)
      request["Content-Type"] = "application/json"
      request["X-Timestamp"] = timestamp
      request["X-Signature"] = "sha256=#{OpenSSL::HMAC.hexdigest("sha256", webhook.secret, "#{timestamp}.#{json}")}"
      request.body = json

      http = Net::HTTP.new(uri.hostname, uri.port)
      http.ipaddr = address # connect to the checked address, not a fresh DNS answer
      http.use_ssl = uri.scheme == "https"
      http.open_timeout = TIMEOUT
      http.read_timeout = TIMEOUT
      http.write_timeout = TIMEOUT

      response = http.request(request)

      [response.code.to_i, response.body.to_s.byteslice(0, MAX_RESPONSE_BYTES).scrub]
    end

    def success?(http_code) = http_code.to_i.between?(200, 299)
  end
end
