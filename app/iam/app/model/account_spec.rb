# frozen_string_literal: true

require "spec_helper"

RSpec.describe Account, database: true do
  describe Account::Repository do
    subject{ described_class.new(Verse::Auth::Context.new) }

    it "can be instantiated" do
      expect(subject).to be_a(Account::Repository)
    end
  end
end