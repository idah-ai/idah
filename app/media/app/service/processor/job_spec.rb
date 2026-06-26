# frozen_string_literal: true

RSpec.describe Processor::Job, database: true do
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

  let(:resource) { "some-resource-identifier" }
  let(:jobs) { Jobs::Repository.new(Verse::Auth::Context.new) }

  def build_job(job_id = UUIDv7.generate)
    Processor::Job.new(
      job_id,
      {
        entry_id: "entry-id",
        processor_class_name: [self.class.name, "Spec::SampleProcessor"].join("::"),
        resource: resource,
        options_class_name: [self.class.name, "Spec::SampleOptions"].join("::"),
        options: {},
      }
    )
  end

  def create_completed_job(for_resource:)
    id = jobs.create(
      job_class: "Processor::Job",
      arguments: { resource: for_resource },
      status: "completed",
      priority: 0,
      scheduled_at: Time.now,
      retry_count: 0
    )
    jobs.find!(id)
  end

  describe "#run_impl" do
    before { Spec::SampleProcessor.ran = false }

    it "runs the processor when the resource has not been processed" do
      build_job.run_impl

      expect(Spec::SampleProcessor.ran).to be true
    end

    it "skips the processor when a completed job already processed the resource" do
      create_completed_job(for_resource: resource)

      build_job.run_impl

      expect(Spec::SampleProcessor.ran).to be false
    end

    it "still runs when the only completed job for the resource is itself" do
      own = create_completed_job(for_resource: resource)

      build_job(own.id).run_impl

      expect(Spec::SampleProcessor.ran).to be true
    end
  end
end
