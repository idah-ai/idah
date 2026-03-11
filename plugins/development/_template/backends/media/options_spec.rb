# frozen_string_literal: true

require "spec_helper"
require_relative "options"

RSpec.describe {{pluginModule}}::Options do
  it "is an empty schema" do
    expect(described_class).to eq(Verse::Schema.empty)
  end
end
