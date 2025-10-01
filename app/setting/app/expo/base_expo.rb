# frozen_string_literal: true

require "verse/json_api"

class BaseExpo < Verse::Exposition::Base
  def self.inherited(klass)
    super
    klass.renderer Verse::JsonApi::Renderer
  end
end
