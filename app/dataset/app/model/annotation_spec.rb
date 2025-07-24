# frozen_string_literal: true

require "spec_helper"

RSpec.describe Annotation, database: true do
  describe Annotation::Repository do
    subject{ described_class.new(Verse::Auth::Context.new) }

    it "can be instantiated" do
      expect(subject).to be_a(Annotation::Repository)
    end
  end
end
