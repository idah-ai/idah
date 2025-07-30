# frozen_string_literal: true

require "verse/json_api"

Api::Exposition.include(Verse::JsonApi::Deserializer)
