# frozen_string_literal: true

require "spec_helper"

RSpec.describe NoteComment, database: true do
  describe NoteComment::Repository do
    subject{ described_class.new(Verse::Auth::Context.new) }

    it "can be instantiated" do
      expect(subject).to be_a(NoteComment::Repository)
    end
  end
end
