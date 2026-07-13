# frozen_string_literal: true

# Shared observability setup for all services: OpenTelemetry instrumentation
# bridged into Sentry via sentry-opentelemetry (config.instrumenter = :otel).
# The whole stack no-ops when SENTRY_DSN is not set.
module Telemetry
  extend self

  # Verse business errors rendered as 4xx HTTP responses — not defects.
  IGNORED_ERRORS = %w[
    Verse::Error::ValidationFailed
    Verse::Error::NotFound
    Verse::Error::RecordNotFound
    Verse::Error::BadRequest
    Verse::Error::Unauthorized
    Verse::Error::Authorization
    Verse::Error::AuthenticationFailed
  ].freeze

  def enabled?
    !ENV["SENTRY_DSN"].to_s.empty?
  end

  def tracer
    @tracer ||= OpenTelemetry.tracer_provider.tracer("idah", "1.0")
  end

  # Called from Verse.on_boot: Verse config is loaded (service_name available)
  # and the event manager instance exists, but routes are not yet registered
  # and Puma is not serving.
  def setup!
    return unless enabled?

    service_name = "idah-#{Verse.service_name}"

    Sentry.init do |config|
      config.dsn = ENV["SENTRY_DSN"]
      config.environment = ENV.fetch("APP_ENVIRONMENT", "development")

      config.breadcrumbs_logger = [:sentry_logger, :http_logger]
      config.send_default_pii = false
      config.background_worker_threads = 3

      # Spans are produced by OpenTelemetry and bridged by the span processor
      # below; the Sentry SDK must not start its own transactions.
      config.instrumenter = :otel
      config.traces_sample_rate = ENV.fetch("SENTRY_TRACES_SAMPLE_RATE", "1.0").to_f

      config.excluded_exceptions += IGNORED_ERRORS
    end

    # Spans reach Sentry through the bridge processor, not an OTLP exporter.
    ENV["OTEL_TRACES_EXPORTER"] ||= "none"

    OpenTelemetry::SDK.configure do |c|
      c.service_name = service_name
      c.resource = OpenTelemetry::SDK::Resources::Resource.create(
        "service.instance.id" => Verse.service_id,
        "deployment.environment" => ENV.fetch("APP_ENVIRONMENT", "development")
      )

      c.use "OpenTelemetry::Instrumentation::Rack"
      c.use "OpenTelemetry::Instrumentation::Sinatra"
      # Never trace the SDK's own envelope uploads to Sentry — the bridge's
      # from_sentry_sdk? filter misses them under the stable HTTP semconv
      # naming, which otherwise floods traces with self-referential POSTs.
      c.use "OpenTelemetry::Instrumentation::Net::HTTP",
            untraced_hosts: [Sentry.configuration.dsn&.host].compact
      c.use "OpenTelemetry::Instrumentation::PG", db_statement: :obfuscate
      c.use "OpenTelemetry::Instrumentation::ConcurrentRuby"
    end

    OpenTelemetry.tracer_provider.add_span_processor(
      Sentry::OpenTelemetry::SpanProcessor.instance
    )
    OpenTelemetry.propagation = Sentry::OpenTelemetry::Propagator.new

    # Added after the middleware declared in the Server class body, therefore
    # inner to Verse's ErrorHandler: sees exceptions before they are swallowed
    # and rendered as HTTP error responses.
    Verse::Http::Server.use ::Sentry::Rack::CaptureExceptions if defined?(Verse::Http::Server)

    if defined?(Verse::Redis::Stream::EventManager)
      Verse::Redis::Stream::EventManager.prepend(Telemetry::EventManagerPatch)
    end

    Verse.logger.info { "Telemetry enabled for #{service_name}" }
  end

  # -- trace context propagation over the event bus --

  # Merge the current trace context into event headers (producer side).
  def inject_headers(headers)
    return headers unless enabled?

    carrier = {}
    OpenTelemetry.propagation.inject(carrier)
    headers.merge(carrier.transform_keys(&:to_sym))
  end

  # Rebuild the trace context from event headers (consumer side).
  # Messages round-trip through msgpack with symbolized keys.
  def extract_context(headers)
    OpenTelemetry.propagation.extract((headers || {}).transform_keys(&:to_s))
  end
end
