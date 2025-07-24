# frozen_string_literal: true

require "spec_helper"

RSpec.describe Entry, database: true do
  describe Entry::Repository do
    subject{ described_class.new(Verse::Auth::Context.new) }

    it "can be instantiated" do
      expect(subject).to be_a(Entry::Repository)
    end
  end
end
