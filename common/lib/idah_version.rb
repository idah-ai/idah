# frozen_string_literal: true

# The release a service was built from.
#
# The CD workflow stamps IDAH_VERSION and IDAH_GIT_SHA into the image as build
# arguments. A build without them - a local build, or a container started from
# source - reports the development placeholders instead.
module IdahVersion
  extend self

  DEV_VERSION = "0.0.0-dev"
  UNKNOWN_REVISION = "unknown"

  # The platform version, e.g. "0.4.0". All services of a release share it.
  def number
    presence(ENV["IDAH_VERSION"]) || DEV_VERSION
  end

  # The commit the image was built from, or "unknown".
  def revision
    presence(ENV["IDAH_GIT_SHA"]) || UNKNOWN_REVISION
  end

  # Reported by /healthcheck.
  def to_h
    { version: number, revision: revision }
  end

  private

  # A build argument that is declared but never set arrives as an empty string.
  def presence(value)
    value unless value.nil? || value.strip.empty?
  end
end
