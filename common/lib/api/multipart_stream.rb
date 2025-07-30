# frozen_string_literal: true

require "securerandom"

class Api
  # Streaming class for multipart data
  class MultipartStream
    def initialize(params, boundary)
      @params = params
      @boundary = boundary
      @current_part = 0
      @current_file = nil
      @current_position = 0
      @parts = build_parts
    end

    def read(length = nil, buffer = nil)
      buffer ||= String.new
      buffer.clear

      return nil if @current_part >= @parts.length

      bytes_read = 0
      target_length = length || 8192

      while bytes_read < target_length && @current_part < @parts.length
        part = @parts[@current_part]

        case part[:type]
        when :string
          remaining = part[:content].bytesize - @current_position
          to_read = [remaining, target_length - bytes_read].min

          buffer << part[:content][@current_position, to_read]
          @current_position += to_read
          bytes_read += to_read

          if @current_position >= part[:content].bytesize
            @current_part += 1
            @current_position = 0
          end

        when :file
          unless @current_file
            @current_file = part[:file]
            @current_file.seek(0) if @current_file.respond_to?(:seek)
          end

          to_read = target_length - bytes_read
          chunk = @current_file.read(to_read)

          if chunk && !chunk.empty?
            buffer << chunk
            bytes_read += chunk.bytesize
          else
            # File is done
            @current_file.close if @current_file.respond_to?(:close) && part[:should_close]
            @current_file = nil
            @current_part += 1
            @current_position = 0
          end
        end
      end

      bytes_read > 0 ? buffer : nil
    end

    def rewind
      @current_part = 0
      @current_position = 0
      @current_file&.close if @current_file.respond_to?(:close)
      @current_file = nil
    end

    private

    def build_parts
      parts = []

      @params.each do |key, value|
        if file_like?(value)
          filename = get_filename(value)
          content_type = get_content_type(value)

          # Add header part
          header = "--#{@boundary}\r\n" \
                   "Content-Disposition: form-data; name=\"#{key}\"; filename=\"#{filename}\"\r\n" \
                   "Content-Type: #{content_type}\r\n\r\n"
          parts << { type: :string, content: header }

          # Add file part
          parts << {
            type: :file,
            file: value,
            should_close: !value.respond_to?(:original_filename) # Don't close Rails uploaded files
          }

          # Add trailing CRLF
          parts << { type: :string, content: "\r\n" }
        else
          # Regular field
          header = "--#{@boundary}\r\n" \
                   "Content-Disposition: form-data; name=\"#{key}\"\r\n\r\n"
          content = "#{value}\r\n"

          parts << { type: :string, content: header + content }
        end
      end

      # Final boundary
      parts << { type: :string, content: "--#{@boundary}--\r\n" }

      parts
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
  end
end
