# frozen_string_literal: true

# Register the outermost exposition handler now — before Verse.start
# autoloads exposition subclasses, which snapshot the handler list at
# class-load time. (If eager loading is ever added to boot.rb before
# initializers, move this call to the end of boot.rb instead.)
Verse::Exposition::Base.prepend_handler(Telemetry::ExpositionHandler)

# Full SDK setup once Verse config and plugins are initialized, before
# routes register and Puma serves. No-op when SENTRY_DSN is unset.
Verse.on_boot { Telemetry.setup! }
