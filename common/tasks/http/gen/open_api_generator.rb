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

      # Process schema to extract definitions and update references
      def process_schema(method_group, schema, components_schemas)
        return schema unless schema.is_a?(Hash)

        schema = JSON.parse(JSON.generate(schema)) # Deep clone

        # Extract definitions (from $defs or definitions)
        defs = schema.delete("$defs") || schema.delete("definitions")
        defs&.each do |name, definition|
          components_schemas["#{method_group}#{name}"] = update_refs(definition, method_group)
        end

        update_refs(schema, method_group)
      end

      # Update $ref paths to point to components/schemas
      def update_refs(obj, method_group)
        case obj
        when Hash
          obj.transform_values do |v|
            if v.is_a?(String) && v.start_with?("#/$defs/")
              v.sub(
                "#/$defs/",
                "#/components/schemas/#{method_group}"
              )
            else
              update_refs(v, method_group)
            end
          end
        when Array
          obj.map { |item| update_refs(item, method_group) }
        else
          obj
        end
      end

      # Converts "My::ClassName" to "MyClassName"
      # Converts "my_method_name" to "MyMethodName"
      def camel_cased_name(name)
        name.to_s.split(/::|_/)
            .reject { |v| v.nil? || v.empty? }
            .map { |str| str[0].capitalize + str[1..] }.join
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
            },
            "schemas" => {}
          }
        }

        nil_auth_strategy = Verse::Http::Auth.get(nil)
        tags_seen = {}

        Verse::Exposition::Base.all_expositions.each do |expo|
          resource_name = expo.name.gsub(/Expo$/, "")
          resource_description = expo.desc || ""

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

            # Track tags
            tag = camel_cased_name(resource_name)
            unless tags_seen[tag]
              tags_seen[tag] = true
              openapi["tags"] << { "name" => tag, description: resource_description }
            end

            # Fetch parameters from input schema
            schema_method_name = camel_cased_name(method_name)
            input_params = prepare_input_parameters(
              http_method,
              in_path_param_names,
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
                          "#{resource_name}#{schema_method_name}",
                          output_schema ? Verse::Schema::Json.from(output_schema) : { "type" => "object" },
                          openapi["components"]["schemas"]
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
                  process_schema(
                    "#{resource_name}#{schema_method_name}",
                    request_body_schema,
                    openapi["components"]["schemas"]
                  )
                else
                  { "type" => "object" }
                end

              operation["requestBody"] = {
                "content" => {
                  content_type => {
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

        # Generate and return the OpenAPI JSON
        JSON.pretty_generate(openapi)
      end
    end
  end
end
