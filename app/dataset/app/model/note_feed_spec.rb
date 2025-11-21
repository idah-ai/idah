# frozen_string_literal: true

require "spec_helper"

RSpec.describe NoteFeed, database: true do
  describe NoteFeed::Repository do
    subject{ described_class.new(Verse::Auth::Context.new) }

    it "can be instantiated" do
      expect(subject).to be_a(NoteFeed::Repository)
    end
  end
end
