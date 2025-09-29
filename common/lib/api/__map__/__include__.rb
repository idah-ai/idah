# frozen_string_literal: true

require "verse/json_api"

Api::Exposition.include(Verse::JsonApi::Deserializer)

Api[:idah].base_url = \
  [ENV.fetch("IDAH_URL"), "api/v1/"].join("/")

Api[:idah].register_service(:media).base_path = "media"

Api[:idah].register_service(:iam).base_path = "iam"
