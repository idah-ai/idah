# frozen_string_literal: true

module Telemetry
  # Prepended into Verse::Redis::Stream::EventManager by Telemetry.setup!.
  # Creates producer/consumer spans around the event bus and carries the
  # trace context inside message headers, so a trace continues from the
  # publishing service into every subscriber.
  module EventManagerPatch
    def publish(channel, content, headers: {}, **kw)
      return super unless Telemetry.enabled?

      Telemetry.tracer.in_span(
        "publish #{channel}",
        kind: :producer,
        attributes: {
          "messaging.system" => "verse-redis",
          "messaging.destination.name" => channel.to_s
        }
      ) do
        super(channel, content, headers: Telemetry.inject_headers(headers), **kw)
      end
    end

    def publish_resource_event(resource_type:, resource_id:, event:, payload:, headers: {})
      return super unless Telemetry.enabled?

      channel = "#{resource_type}.#{event}"

      Telemetry.tracer.in_span(
        "publish #{channel}",
        kind: :producer,
        attributes: {
          "messaging.system" => "verse-redis",
          "messaging.destination.name" => channel
        }
      ) do
        super(resource_type:, resource_id:, event:, payload:, headers: Telemetry.inject_headers(headers))
      end
    end

    # Single consume entry point for both simple and stream subscribers.
    # Messages published before this deploy carry no trace headers and simply
    # start a fresh root trace.
    def dispatch_message(channel, message)
      return super unless Telemetry.enabled?

      context = Telemetry.extract_context(message.headers)

      OpenTelemetry::Context.with_current(context) do
        Telemetry.tracer.in_span(
          "consume #{channel}",
          kind: :consumer,
          attributes: {
            "messaging.system" => "verse-redis",
            "messaging.destination.name" => channel.to_s
          }
        ) do
          super
        end
      end
    end
  end
end
