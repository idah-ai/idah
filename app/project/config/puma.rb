# frozen_string_literal: true

workers 0
threads 5, 5

port ENV.fetch("PORT", 3000)
environment ENV.fetch("APP_ENVIRONMENT", "development")

preload_app!
