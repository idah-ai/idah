# frozen_string_literal: true

require "cgi"
require "net/http"
require "json"
require "uri"
require "pry"
require_relative "./multipart_stream"

class Api
  class Exposition
    attr_reader :parent, :name

    def initialize(parent, name)
      @parent = parent
      @name = name
      @expositions = {}
    end

    def get(path, headers: {}, params: {}, options: {})
      execute_request(:get, path, headers: headers, params: params, options: options)
    end

    def post(path, headers: {}, params: {}, options: {})
      execute_request(:post, path, headers: headers, params: params, options: options)
    end

    def put(path, headers: {}, params: {}, options: {})
      execute_request(:put, path, headers: headers, params: params, options: options)
    end

    def patch(path, headers: {}, params: {}, options: {})
      execute_request(:patch, path, headers: headers, params: params, options: options)
    end

    def delete(path, headers: {}, params: {}, options: {})
      execute_request(:delete, path, headers: headers, params: params, options: options)
    end

    def register(method_name, &block)
      define_singleton_method(method_name, &block)
    end

    private

    def execute_request(method, path, headers: {}, params: {}, options: {})
      # Extract path parameters
      path_params = []
      processed_path = path.gsub(/:\w+/) do |match|
        symbol = match[1..].to_sym
        path_params << symbol
        params[symbol] || raise("Missing parameter: #{symbol}")
      end

      # Remove path params from params hash
      remaining_params = params.except(*path_params)

      # Build URI
      uri = build_uri(processed_path, method, remaining_params, headers)

      # Create HTTP request
      request = create_request(method, uri, headers, remaining_params)

      # Handle authentication if needed
      if options[:auth]
        parent.auth(options[:auth], request)
      end

      # Execute request
      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = (uri.scheme == "https")

      response = http.request(request)

      if response.code.to_i >= 400
        raise "HTTP Error: #{response.code} - #{response.message}"
      end

      response
    end

    def to_query(hash, prefix = nil)
      hash.flat_map do |k, v|
        key = prefix ? "#{prefix}[#{k}]" : k.to_s
        v.is_a?(Hash) ? to_query(v, key) : [[key, v]]
      end
    end

    def build_uri(path, method, params, _headers)
      base_url = parent.base_url || raise("Base URL not configured")
      uri = URI.join(base_url, path)

      # For GET and DELETE, add params as query string
      if [:get, :delete].include?(method) && !params.empty?
        query_params = URI.encode_www_form(to_query(params))

        uri.query = uri.query ? "#{uri.query}&#{query_params}" : query_params
      end

      uri
    end

    def create_request(method, uri, headers, params)
      request_class = case method
                      when :get then Net::HTTP::Get
                      when :post then Net::HTTP::Post
                      when :put then Net::HTTP::Put
                      when :patch then Net::HTTP::Patch
                      when :delete then Net::HTTP::Delete
                      end

      request = request_class.new(uri)

      # Set headers
      headers.each { |key, value| request[key] = value }

      # Handle body for non-GET/DELETE methods
      if [:post, :put, :patch].include?(method) && !params.empty?
        set_request_body(request, params, headers)
      end

      request
    end

    def set_request_body(request, params, headers)
      content_type = headers["Content-Type"] || headers["content-type"]

      if content_type&.include?("multipart/form-data")
        # Handle multipart form data with streaming
        set_multipart_streaming_body(request, params)
      elsif content_type&.include?("application/x-www-form-urlencoded")
        # Handle form-encoded body
        set_form_body(request, params)
      elsif content_type&.include?("application/json") || params.is_a?(Hash)
        # Handle JSON body (default for Hash params when no content type specified)
        set_json_body(request, params, headers)
      else
        # Handle form-encoded body as fallback
        set_form_body(request, params)
      end
    end

    def set_json_body(request, params, headers)
      request.body = params.to_json
      # Add content-type if not present and body is a Hash
      return if headers.key?("Content-Type") || headers.key?("content-type")

      request["Content-Type"] = "application/json"
    end

    def set_form_body(request, params)
      request.set_form_data(params)
    end

    def set_multipart_streaming_body(request, params)
      boundary = "----FormBoundary#{SecureRandom.hex(16)}"
      request["Content-Type"] = "multipart/form-data; boundary=#{boundary}"

      # Calculate total content length
      content_length = calculate_multipart_length(params, boundary)
      request["Content-Length"] = content_length.to_s

      # Set up streaming body
      request.body_stream = MultipartStream.new(params, boundary)
    end

    def calculate_multipart_length(params, boundary)
      total_length = 0

      params.each do |key, value|
        if file_like?(value)
          filename = get_filename(value)
          content_type = get_content_type(value)

          # Header part length
          header = "--#{boundary}\r\n" \
                   "Content-Disposition: form-data; name=\"#{key}\"; filename=\"#{filename}\"\r\n" \
                   "Content-Type: #{content_type}\r\n\r\n"
          total_length += header.bytesize

          # File content length
          total_length += get_file_size(value)

          # Trailing CRLF
        else
          # Regular field
          header = "--#{boundary}\r\n" \
                   "Content-Disposition: form-data; name=\"#{key}\"\r\n\r\n"
          total_length += header.bytesize
          total_length += value.to_s.bytesize
        end
        total_length += 2
      end

      # Final boundary
      total_length += "--#{boundary}--\r\n".bytesize

      total_length
    end

    def file_like?(value)
      value.respond_to?(:read) && (value.respond_to?(:size) || value.respond_to?(:stat))
    end

    def get_filename(file)
      return file.original_filename if file.respond_to?(:original_filename)
      return File.basename(file.path) if file.respond_to?(:path)

      "file"
    end

    def get_content_type(file)
      return file.content_type if file.respond_to?(:content_type)

      "application/octet-stream"
    end

    def get_file_size(file)
      return file.size if file.respond_to?(:size)
      return file.stat.size if file.respond_to?(:stat)

      raise "Cannot determine file size for streaming"
    end
  end
end
