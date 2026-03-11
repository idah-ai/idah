# frozen_string_literal: true

require "spec_helper"
require_relative "processor"

RSpec.describe {{pluginModule}}::Processor do
  # TODO: to be removed by plugin developers after implementing the processing functionality
  it "raises NotImplementedError when run is called" do
    processor = described_class.new(double("context"))

    expect { processor.run }.to(
      raise_error(NotImplementedError, "plugin must implement the run method for processing media")
    )
  end
end
