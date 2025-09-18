# frozen_string_literal: true

require "spec_helper"

RSpec.describe Datset::Service, database: true do
  let(:auth_context){ Verse::Auth::Context.new }

  subject { described_class.new(auth_context) }

  describe "#export" do
    it "generate a correct datset structure" do
      subject.export()
    end
  end
end
