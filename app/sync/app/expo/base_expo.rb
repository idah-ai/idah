# frozen_string_literal: true

# Test CI
require "verse/json_api"

class BaseExpo < Verse::Exposition::Base
  def self.inherited(klass)
    super
    klass.renderer Verse::JsonApi::Renderer
  end
end
