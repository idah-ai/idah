# frozen_string_literal: true

RSpec.describe Processor::Job do
  module Spec
    SampleOptions = Verse::Schema.empty.dataclass

    class SampleProcessor
      class << self
        attr_accessor :ran
      end

      attr_reader :context

      def initialize(context)
        @context = context
      end

      def run
        self.class.ran = true
      end
    end
  end

  describe "#run_impl" do
    it "raises NotImplementedError" do
      Spec::SampleProcessor.ran = false

      job = Processor::Job.new(
        1,
        {
          entry_id: "entry-id",
          processor_class_name: [self.class.name, "Spec::SampleProcessor"].join("::"),
          resource: "some-resource-identifier",
          options_class_name: [self.class.name, "Spec::SampleOptions"].join("::"),
          options: {},
        }
      )

      job.run_impl

      expect(Spec::SampleProcessor.ran).to be true
    end
  end
end
