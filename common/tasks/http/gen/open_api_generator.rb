# frozen_string_literal: true

require "json"
require "verse/core"

module Http
  module Gen
    module OpenApiGenerator
      module_function

      def prepare_input_parameters(http_method, in_path_param_names, input_schema)
        parameters = in_path_param_names.map do |name|
          { "name" => name, "in" => "path", "required" => true, "schema" => { "type" => "string" } }
        end

        return { parameters:, request_body_schema: nil } if input_schema.nil?

        if %w[post put patch].include?(http_method.to_s.downcase)
          request_body_schema = generate_schema(input_schema, in_path_param_names)
          { parameters:, request_body_schema: }
        else
          query_parameters = []
          generate_parameters_from_schema(input_schema, query_parameters, in_path_param_names)
          parameters += query_parameters
          { parameters:, request_body_schema: nil }
        end
      end

      # Recursively traverse the input schema and build the parameters array or request body schema
      def generate_schema(schema, in_path_param_names = [])
        result = { "type" => "object", "properties" => {}, "required" => [] }

        schema.fields.each do |field|
          name = field.name
          next if in_path_param_names.include?(name)

          field_schema = map_field_to_schema(field)
          result["properties"][name] = field_schema
          result["required"] << name if field.required?
        end

        result["required"].sort! if result["required"].any?

        result
      end

      def map_literal(klass, of: nil)
        out = {}
        case klass.to_s
        when "String", "Symbol", "Date", "Time"
          out["type"] = "string"
        when "Integer"
          out["type"] = "integer"
          out["format"] = "int64"
        when "Float"
          out["type"] = "number"
          out["format"] = "double"
        when "TrueClass", "FalseClass"
          out["type"] = "boolean"
        when "Array"
          out["type"] = "array"
          out["items"] = {
            "type": (of ? map_literal(of)["type"] : "object")
          }
        else
          out["type"] = "object"
        end

        out
      end

      def map_field_to_schema(field)
        type = field.type
        meta = field.opts[:meta] || {}
        schema = {}

        case type.to_s
        when "String"
          schema["type"] = "string"
        when "Integer"
          schema["type"] = "integer"
          schema["format"] = "int64"
        when "Float"
          schema["type"] = "number"
          schema["format"] = "double"
        when "TrueClass", "FalseClass"
          schema["type"] = "boolean"
        when "Date"
          schema["type"] = "string"
          schema["format"] = "date"
        when "DateTime", "Time"
          schema["type"] = "string"
          schema["format"] = "date-time"
        when "Array"
          schema["type"] = "array"
          schema["items"] =
            if field.opts[:of] && field.opts[:of].respond_to?(:fields)
              field.opts[:of].fields.map{ |f| map_field_to_schema(f) }
            else
              map_literal(field.opts[:of])
            end
        when "Symbol"
          schema["type"] = "string"
        when "Hash"
          if field.opts[:schema]
            schema = generate_schema(field.opts[:schema])
          elsif field.opts[:of]
            schema["type"] = "object"
            schema["additionalProperties"] =
              if field.opts[:of].respond_to?(:fields)
                field.opts[:of].fields.map{ |f| map_field_to_schema(f) }
              else
                map_literal(field.opts[:of])
              end
          else
            schema["type"] = "object"
          end
        else
          schema["type"] = "object"
        end

        schema["description"] = meta[:description] if meta[:description]

        schema
      end

      def generate_parameters_from_schema(schema, parameters, in_path_param_names, prefix = "")
        schema.fields.each do |field|
          name = field.name
          next if in_path_param_names.include?(name)

          full_name = prefix.empty? ? name : "#{prefix}[#{name}]"
          meta = field.opts[:meta] || {}
          sub_schema = field.opts[:schema]

          if sub_schema
            # Nested object
            generate_parameters_from_schema(sub_schema, parameters, [], full_name)
          else
            parameter = {
              "name" => (field.type == Array ? "#{full_name}[]" : full_name),
              "in" => "query",
              "required" => field.required?,
              "schema" => map_literal(field.type, of: field.opts[:of])
            }

            if parameter["schema"]["type"] == "object"
              parameter["schema"]["type"] = "string" # we are in query string...
            end

            parameter["description"] = meta[:description] if meta[:description]

            parameters << parameter
          end
        end
      end

      def generate
        domain = Verse.service_name

        openapi = {
          "openapi" => "3.0.0",
          "info" => {
            "title" => domain.capitalize,
            "description" => Verse::Config.config[:description],
            "version" => "1.0.0"
          },
          "servers" => [
            {
              "url" => "#{ENV["IDAH_URL"]}/api/v1/#{domain}"
            }
          ],
          "paths" => {},
          "components" => {
            "securitySchemes" => {
              "bearerAuth" => {
                "type": "http",
                "scheme": "bearer",
                "bearerFormat": "JWT"
              }
            }
          }
        }

        nil_auth_strategy = Verse::Http::Auth.get(nil)

        Verse::Exposition::Base.all_expositions.each do |expo|
          expo.exposed_endpoints.each do |method_name, data|
            hook = data[:type]
            next unless hook.is_a?(Verse::Http::Exposition::Hook)

            # Convert path parameters to OpenAPI format
            path = hook.path.gsub(/:(\w+)/, '{\1}')

            # HTTP method
            http_method = hook.http_method.to_s.downcase

            # Description from metablock
            description = (hook.metablock.desc || "").strip

            # Extract path parameter names
            in_path_param_names = hook.path.scan(/:(\w+)/).flatten

            # Fetch parameters from input schema
            input_params = prepare_input_parameters(hook.http_method, in_path_param_names, hook.metablock.input_schema)
            parameters = input_params[:parameters]
            request_body_schema = input_params[:request_body_schema]

            # Determine content type based on renderer
            content_type =
              case hook.renderer.to_s
              when "Verse::JsonApi::Renderer"
                "application/vnd.api+json"
              when "Verse::Http::Renderer::Json"
                "application/json"
              else
                "application/json"
              end

            # Responses
            responses = {
              "200" => {
                "description" => "Successful response",
                "content" => {
                  content_type => {
                    "schema" => {
                      "type" => "object"
                    }
                  }
                }
              }
            }

            # Operation object
            operation = {
              "summary" => method_name.to_s,
              "description" => description,
              "parameters" => parameters,
              "responses" => responses
            }

            # Add security if authentication is required
            if hook.auth != nil_auth_strategy
              operation["security"] = [
                { "bearerAuth" => [] }
              ]
            end

            # Add requestBody for methods that support it
            if %w[post put patch].include?(http_method)
              operation["requestBody"] = {
                "content" => {
                  content_type => {
                    "schema" => request_body_schema || { "type" => "object" }
                  }
                }
              }
            end

            # Initialize path if it doesn't exist
            openapi["paths"][path] ||= {}
            openapi["paths"][path][http_method] = operation
          end
        end

        # Generate and return the OpenAPI JSON
        JSON.pretty_generate(openapi)
      end
    end
  end
end
