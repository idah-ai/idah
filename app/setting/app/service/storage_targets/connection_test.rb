# frozen_string_literal: true

require "uri"

module StorageTargets
  # Checks that a storage target works before it is saved: puts a small probe
  # object under the target's prefix, reads it back and deletes it, so missing
  # write or delete permissions show up too.
  #
  # Returns nil when the target works, or an error code. Codes are generic on
  # purpose: the raw S3 error can echo request details, and HTTP errors show
  # their message to the client.
  class ConnectionTest
    TIMEOUT = 5 # seconds, to connect and for each read
    PROBE_CONTENT = "idah storage target probe"

    # S3-compatible stores ignore the region, but the SDK needs one to sign.
    DEFAULT_REGION = "us-east-1"

    ACCESS_DENIED = %w[AccessDenied InvalidAccessKeyId SignatureDoesNotMatch AllAccessDisabled].freeze
    BUCKET_NOT_FOUND = %w[NoSuchBucket PermanentRedirect].freeze

    def initialize(client_factory: nil)
      @client_factory = client_factory || lambda { |options|
        require "aws-sdk-s3"
        Aws::S3::Client.new(**options)
      }
    end

    def call(endpoint:, bucket:, access_key_id:, secret_access_key:, region: nil, prefix: nil)
      error = check_endpoint(endpoint)
      return error if error

      client = @client_factory.call(
        endpoint:,
        region: region.to_s.empty? ? DEFAULT_REGION : region,
        access_key_id:,
        secret_access_key:,
        http_open_timeout: TIMEOUT,
        http_read_timeout: TIMEOUT,
        retry_limit: 0
      )

      probe(client, bucket, probe_key(prefix))
    end

    private

    def probe(client, bucket, key)
      client.put_object(bucket:, key:, body: PROBE_CONTENT)
      content = client.get_object(bucket:, key:).body.read
      client.delete_object(bucket:, key:)

      content == PROBE_CONTENT ? nil : "connection_failed"
    rescue StandardError => e
      Verse.logger&.warn { "[storage_targets] connection test failed: #{e.class}" }
      error_code(e)
    end

    def error_code(error)
      code = error.respond_to?(:code) ? error.code.to_s : ""

      return "access_denied" if ACCESS_DENIED.include?(code)
      return "bucket_not_found" if BUCKET_NOT_FOUND.include?(code)
      return "unreachable" if network_error?(error)

      "connection_failed"
    end

    def network_error?(error)
      defined?(Seahorse::Client::NetworkingError) && error.is_a?(Seahorse::Client::NetworkingError) ||
        error.is_a?(SocketError) || error.is_a?(Timeout::Error) || error.is_a?(SystemCallError)
    end

    def check_endpoint(endpoint)
      uri = URI.parse(endpoint.to_s)
      return "invalid_endpoint" unless uri.is_a?(URI::HTTP) && uri.host && !uri.host.empty?
      return "https_required" if uri.scheme != "https" && !plain_http_allowed?

      nil
    rescue URI::InvalidURIError
      "invalid_endpoint"
    end

    # Local S3 stand-ins (MinIO and the like) usually speak plain HTTP.
    def plain_http_allowed?
      %w[development test].include?(ENV.fetch("APP_ENVIRONMENT", "development"))
    end

    def probe_key(prefix)
      prefix = prefix.to_s.gsub(%r{\A/+|/+\z}, "")
      [prefix, ".idah-probe-#{UUIDv7.generate}"].reject(&:empty?).join("/")
    end
  end
end
