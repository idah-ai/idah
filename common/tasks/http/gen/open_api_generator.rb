# frozen_string_literal: true

require "json"
require "verse/core"

module Http
  module Gen
    module OpenApiGenerator
      module_function

      def prepare_input_parameters(http_method, in_path_param_names, in_path_optional_param_names, input_schema)
        parameters = in_path_param_names.map do |name|
          {
            "name" => name, "in" => "path",
            "required" => !in_path_optional_param_names.include?(name),
            "schema" => { "type" => "string" }
          }
        end

        return { parameters:, request_body_schema: nil } if input_schema.nil?

        if %w[post put patch].include?(http_method.to_s.downcase)
          request_body_schema = Verse::Schema::Json.from(input_schema)
          { parameters:, request_body_schema: }
        else
          query_parameters = []
          generate_parameters_from_schema(input_schema, query_parameters, in_path_param_names)
          parameters += query_parameters
          { parameters:, request_body_schema: nil }
        end
      end

      def generate_parameters_from_schema(schema, parameters, in_path_param_names, prefix = "")
        schema.fields.each do |field|
          name = field.name.to_s

          next if in_path_param_names.include?(name)

          full_name = prefix.empty? ? name : "#{prefix}[#{name}]"
          meta = field.opts[:meta] || {}
          description = meta[:description] || meta[:desc]
          with_sub_schema = field.type.respond_to?(:field)

          if with_sub_schema
            # Nested object
            generate_parameters_from_schema(field.type, parameters, [], full_name)
          else
            parameter = {
              "name" => (field.type == Array ? "#{full_name}[]" : full_name),
              "in" => "query",
              "required" => field.required?,
              "schema" => Verse::Schema::Json.from(field.type)
            }

            if parameter["schema"][:type] == "object"
              parameter["schema"][:type] = "string" # we are in query string...
            end

            parameter["description"] = description if description

            parameters << parameter
          end
        end
      end

      # Process schema to inline all $defs/definitions directly
      def process_schema(schema)
        return schema unless schema.is_a?(Hash)

        schema = JSON.parse(JSON.generate(schema)) # Deep clone

        # Extract and inline definitions
        defs = schema.delete("$defs") || schema.delete("definitions") || {}

        # Inline all $ref references
        inline_all_refs(schema, defs)
      end

      # Recursively inline all $ref references
      def inline_all_refs(obj, defs)
        case obj
        when Hash
          # If this object has a $ref, replace it with the referenced content
          if obj["$ref"]&.start_with?("#/$defs/")
            ref_name = obj["$ref"].sub("#/$defs/", "")
            if defs[ref_name]
              # Return the inlined schema, recursively processing it
              return inline_all_refs(defs[ref_name], defs)
            end
          end

          # Process all key-value pairs
          obj.transform_values { |value| inline_all_refs(value, defs) }
        when Array
          obj.map { |item| inline_all_refs(item, defs) }
        else
          obj
        end
      end

      # Check if schema contains any IO properties (for multipart/form-data detection)
      def contains_io_property?(schema)
        case schema
        when Hash
          # Check if this object has instanceof: "IO"
          return true if schema["instanceof"] == "IO"

          # Check all properties recursively
          schema.values.any? { |value| contains_io_property?(value) }
        when Array
          schema.any? { |item| contains_io_property?(item) }
        else
          false
        end
      end

      # Humanize resource name for tags
      def humanize_name(name)
        name.to_s.split(/::|(?=[A-Z])|_/)
            .reject { |v| v.nil? || v.empty? }
            .map { |str| str[0].upcase + str[1..] }.join(" ")
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
          "tags" => [],
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
        tags_seen = {}

        Verse::Exposition::Base.all_expositions.each do |expo|
          resource_name = expo.name.gsub(/Expo$/, "")
          resource_description = expo.desc || ""

          allowed_endpoints = expo.exposed_endpoints.select do |_, data|
            data[:type].is_a?(Verse::Http::Exposition::Hook) &&
              !data[:meta].meta&.fetch(:nodoc, false)
          end

          allowed_endpoints.each do |method_name, data|
            hook = data[:type]

            # Convert path parameters to OpenAPI format
            path = hook.path.gsub(/:(\w+)/, '{\1}')

            # HTTP method
            http_method = hook.http_method.to_s.downcase

            # Description from metablock
            description = (hook.metablock.desc || "").strip

            # Extract path parameter names
            # "/medias/files/:resource(/:key)?"
            in_path_param_names = hook.path.scan(/:(\w+)/).flatten
            in_path_optional_param_names = hook.path.scan(%r{\(/:([a-zA-Z_]+)\)\?}).flatten

            # Track tags
            tag = humanize_name(resource_name)
            unless tags_seen[tag]
              tags_seen[tag] = true
              openapi["tags"] << { name: tag, description: resource_description }
            end

            # Fetch parameters from input schema
            input_params = prepare_input_parameters(
              http_method,
              in_path_param_names,
              in_path_optional_param_names,
              hook.metablock.input_schema
            )

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
            output_schema = hook.metablock.output_schema
            responses =
              if output_schema
                {
                  "200" => {
                    "description" => "Successful response",
                    "content" => {
                      content_type => {
                        "schema" => process_schema(
                          Verse::Schema::Json.from(output_schema)
                        )
                      }
                    }
                  }
                }
              else
                {
                  "204" => {
                    "description" => "No content"
                  }
                }
              end

            # Operation object
            operation = {
              "summary" => method_name.to_s,
              "description" => description,
              "parameters" => parameters,
              "responses" => responses,
              "tags" => [tag]
            }

            # Add security if authentication is required
            if hook.auth != nil_auth_strategy
              operation["security"] = [
                { "bearerAuth" => [] }
              ]
            end

            # Add requestBody for methods that support it
            if %w[post put patch].include?(http_method)
              processed_schema =
                if request_body_schema
                  process_schema(request_body_schema)
                else
                  { "type" => "object" }
                end

              # Use multipart/form-data if schema contains IO properties
              request_content_type =
                if processed_schema && contains_io_property?(processed_schema)
                  "multipart/form-data"
                else
                  content_type
                end

              operation["requestBody"] = {
                "content" => {
                  request_content_type => {
                    "schema" => processed_schema
                  }
                }
              }
            end

            # Initialize path if it doesn't exist
            openapi["paths"][path] ||= {}
            openapi["paths"][path][http_method] = operation
          end
        end

        # Return nothing if no paths were added
        return if openapi["paths"].empty?

        # Sort tags alphabetically
        openapi["tags"].sort_by! { |tag| tag[:name] }

        # Generate and return the OpenAPI JSON
        JSON.pretty_generate(openapi)
      end
    end
  end
end
