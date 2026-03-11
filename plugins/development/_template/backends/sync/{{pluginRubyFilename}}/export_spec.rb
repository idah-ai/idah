# frozen_string_literal: true

require "spec_helper"
require_relative "export"

RSpec.describe {{pluginModule}}::Export do
  # TODO: to be removed by plugin developers after implementing the export functionality
  it "raises NotImplementedError when run is called" do
    export = described_class.new

    expect { export.export(double("context")) }.to(
      raise_error(NotImplementedError, "plugin must implement the run method for exporting data")
    )
  end
end
