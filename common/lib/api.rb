# frozen_string_literal: true

class Api
  attr_accessor :base_url, :auths

  @providers = {}

  def initialize
    @auths = {}
  end

  def self.[](provider)
    @providers[provider] ||= Api.new
  end

  def register(service, exposition, method_name, &block)
    service = register_service(service)
    service.register(exposition, method_name, &block)
  end

  def auth(provider, request)
    auth = @auths.fetch(provider) do
      raise "Authentication for provider '#{provider}' not configured"
    end
    auth.call(request)
  end

  def add_auth(provider, &block)
    @auths[provider] = block
  end

  def register_service(service_name)
    @services ||= {}
    @services.fetch(service_name) do
      service = Api::Service.new(self, service_name)
      @services[service_name] = service

      define_singleton_method(service_name){ service }

      service
    end
  end
end

require_relative "api/exposition"
require_relative "api/service"

# Load all API descriptors
Dir.glob(File.join(__dir__, "api", "__map__", "*.rb")).each do |file|
  require file
end
