# frozen_string_literal: true

require "spec_helper"

RSpec.describe ProjectMember, database: true do
  describe ProjectMember::Repository do
    subject{ described_class.new(Verse::Auth::Context.new) }

    it "can be instantiated" do
      expect(subject).to be_a(ProjectMember::Repository)
    end
  end
end
