# frozen_string_literal: true
#
# From: https://github.com/sprql/uuid7-ruby/blob/master/lib/uuid7.rb
# UUID v7 Generator
#
module UUIDv7
  require_relative "uuid_v7/generator"

  # Generate a new UUID v7
  #
  # @api public
  #
  # @example Generate a new UUID v7 for the current timestamp
  #   UUID7.generate
  #
  # @param timestamp [Integer] the timestamp to use for UUID v7
  # @return [String] the generated UUID v7 string
  def self.generate(timestamp: Process.clock_gettime(Process::CLOCK_REALTIME, :millisecond))
    format("%08x-%04x-%04x-%04x-%04x%08x", *Generator.generate(timestamp))
  end
end
