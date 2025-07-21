# frozen_string_literal: true

require "spec_helper"

RSpec.describe Dataset, database: true do
  describe Dataset::Repository do
    subject{ described_class.new(Verse::Auth::Context.new) }

    it "can be instantiated" do
      expect(subject).to be_a(Dataset::Repository)
    end
  end
end
