# frozen_string_literal: true

require "spec_helper"

RSpec.describe Jobs::Base do
  # Minimal concrete subclass that emits an event from its run body.
  let(:job_class) do
    Class.new(described_class) do
      def run_impl
        update_progress(50)
      end
    end
  end

  subject { job_class.new("job-1", {}) }

  describe "#emit" do
    it "raises a clear error when called before run instead of NoMethodError on nil" do
      expect { subject.error("boom") }
        .to raise_error(RuntimeError, /emit called before run/)
    end
  end

  describe "#run" do
    it "routes emitted events to the given block" do
      events = []

      subject.run { |event, **args| events << [event, args] }

      expect(events).to eq([[:update_progress, { value: 50 }]])
    end
  end
end
