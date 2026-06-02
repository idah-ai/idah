# frozen_string_literal: true

require "spec_helper"

RSpec.describe EntryStat, database: true do
  describe EntryStat::Repository do
    subject { described_class.new(Verse::Auth::Context.new) }

    it "can be instantiated" do
      expect(subject).to be_a(EntryStat::Repository)
    end
  end
end
