# frozen_string_literal: true

class Api
  attr_accessor :base_path

  @providers = {}

  def self.[](provider)
    @providers[provider] ||= Api.new
  end

  def register(service, exposition, method_name, &block)
    service = register_service(service)
    service.register(exposition, method_name, &block)
  end

  def path(string, **params)
    path = [base_path, string].join("/").gsub(%r{/{2,}}, "/")
    final_path = path.dup

    # Remove optional path segments if not present on data
    path.scan(%r{(\(/?%{\w+}/?\)\?)}) do
      result = $1
      match = result.match(%r{/?%{(\w+)}/?})
      final_path.gsub!(result, data[match[1].to_sym] ? match[0] : "")
    end

    path.gsub(/:\w+/) do |match|
      key = match[1..].to_sym

      params.fetch(key) do
        raise ArgumentError, "Missing required parameter: #{key}"
      end
    end
  end

  private

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

# Load all API descriptors
Dir.glob(File.join(__dir__, "api", "__map__", "*.rb")).each do |file|
  require file
end
