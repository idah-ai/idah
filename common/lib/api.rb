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

  def self.all(params = {}, &block)
    params[:page] ||= {}
    params[:page][:size] ||= 1_000
    params[:page][:number] ||= 1

    items_per_page = params[:page][:size]

    break_next_page = false

    Verse::Util::Iterator.chunk_iterator(params[:page][:number]) do |current_page|
      params[:page][:number] = current_page

      next nil if break_next_page

      output = block.call(params)

      count = output.data.count
      break_next_page = count < items_per_page
      count == 0 ? nil : output.data
    end
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
