# frozen_string_literal: true

module Telemetry
  # Wraps every exposition invocation (HTTP endpoint or event subscriber) in
  # a named OpenTelemetry span and enriches the Sentry scope with auth and
  # request context.
  #
  # Registered via Verse::Exposition::Base.prepend_handler in each service's
  # config/initializers/00_telemetry.rb — this must happen before exposition
  # subclasses load, as they snapshot the handler list at class-load time.
  class ExpositionHandler < Verse::Exposition::Handler
    PRIMITIVES = [String, Symbol, Integer, Float, TrueClass, FalseClass, NilClass].freeze

    # rubocop:disable Lint/RescueException
    def call
      return call_next unless Telemetry.enabled?

      expo = exposition
      name = "#{expo.class.name}##{expo.current_action}"

      ::Sentry.with_scope do |scope|
        enrich_scope(scope, expo, name)

        begin
          Telemetry.tracer.in_span(name) do |span|
            span.set_attribute("verse.hook", expo.hook.class.name)
            call_next
          end
        rescue Exception => e
          # Verse swallows subscriber errors upstream and renders HTTP errors
          # itself, so capture here while the enriched scope is active. The
          # SDK marks captured exceptions, so the rack middleware won't report
          # them twice; config.excluded_exceptions filters business 4xx.
          ::Sentry.capture_exception(e)
          raise
        end
      end
    end
    # rubocop:enable Lint/RescueException

    private

    def enrich_scope(scope, expo, name)
      scope.set_transaction_name(name)

      metadata = expo.auth_context&.metadata || {}

      scope.set_context("Account Metadata", ensure_primitive(metadata))
      scope.set_context(
        "Exposition",
        {
          class: expo.class.name,
          hook: expo.hook.class.name,
          action: expo.current_action,
          params: expo.respond_to?(:params) ? ensure_primitive(expo.params&.to_h) : nil,
          raw_params: expo.respond_to?(:unsafe_params) ? ensure_primitive(expo.unsafe_params&.to_h) : nil
        }.compact
      )

      role = expo.auth_context&.role
      scope.set_tag(:account_role, role) if role

      user_id = metadata[:id]
      scope.set_user(id: user_id) if user_id

      return unless defined?(Verse::Http::Exposition::Hook) && expo.hook.is_a?(Verse::Http::Exposition::Hook)

      http_method = expo.hook.http_method.to_s.upcase
      scope.set_tag(:http_path, [http_method, expo.hook.path].join("|"))
    end

    # Sentry contexts must contain only JSON-serializable values: keep
    # primitives, walk arrays/hashes, and inspect everything else.
    def ensure_primitive(object)
      case object
      when Hash
        object.to_h { |k, v| [k.to_s, ensure_primitive(v)] }
      when Array
        object.map { |x| ensure_primitive(x) }
      else
        PRIMITIVES.include?(object.class) ? object : object.inspect
      end
    end
  end
end
