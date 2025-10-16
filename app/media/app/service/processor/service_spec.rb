# frozen_string_literal: true

RSpec.describe Processor::Service, type: :service, database: false do
  subject { described_class.new(Verse::Auth::Context.new) }

  describe "#process_entry" do
  end
end
