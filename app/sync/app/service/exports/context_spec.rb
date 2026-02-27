# frozen_string_literal: true

require_relative "../../spec_helper"

RSpec.describe Exports::Context do
  let(:job) { double("Job", progress: 0.0, update_progress: nil) }
  let(:dataset_ids) { [1, 2, 3] }
  let(:options) { { format: "csv" } }
  let(:context) { described_class.new(job, dataset_ids, options) }

  describe "#initialize" do
    it "initializes with job, dataset_ids, and options" do
      expect(context.dataset_ids).to eq(dataset_ids)
      expect(context.options).to eq(options)
    end

    it "initializes with default empty options" do
      ctx = described_class.new(job, dataset_ids)
      expect(ctx.options).to eq({})
    end
  end

  describe "#io" do
    it "returns an IoContext instance" do
      expect(context.io).to be_a(Exports::IoContext)
    end

    it "memoizes the IoContext instance" do
      io1 = context.io
      io2 = context.io
      expect(io1).to be(io2)
    end
  end

  describe "#progress=" do
    it "sets progress on the job" do
      expect(job).to receive(:progress=).with(0.5)
      context.progress = 0.5
    end
  end

  describe "#reschedule!" do
    it "calls reschedule! on the job with default after value" do
      expect(job).to receive(:reschedule!).with(after: 10)
      context.reschedule!
    end

    it "calls reschedule! on the job with custom after value" do
      expect(job).to receive(:reschedule!).with(after: 20)
      context.reschedule!(after: 20)
    end
  end

  describe "#error!" do
    it "calls error on the job with the message" do
      expect(job).to receive(:error).with("Something went wrong")
      context.error!("Something went wrong")
    end
  end

  describe "#datasets" do
    let(:dataset1) { double("Dataset1") }
    let(:dataset2) { double("Dataset2") }
    let(:dataset3) { double("Dataset3") }

    before do
      allow(Exports::DatasetContext).to receive(:new).with(1).and_return(dataset1)
      allow(Exports::DatasetContext).to receive(:new).with(2).and_return(dataset2)
      allow(Exports::DatasetContext).to receive(:new).with(3).and_return(dataset3)
    end

    it "returns an Enumerator" do
      expect(context.datasets).to be_a(Enumerator)
    end

    it "yields DatasetContext instances for each dataset_id" do
      datasets = context.datasets.to_a
      expect(datasets).to eq([dataset1, dataset2, dataset3])
    end

    it "updates job progress after yielding each dataset" do
      expect(job).to receive(:update_progress).with(1.0 / 3).ordered
      expect(job).to receive(:update_progress).with(2.0 / 3).ordered
      expect(job).to receive(:update_progress).with(3.0 / 3).ordered

      context.datasets.to_a
    end

    it "can be iterated multiple times" do
      first_iteration = context.datasets.to_a
      second_iteration = context.datasets.to_a

      expect(first_iteration.size).to eq(3)
      expect(second_iteration.size).to eq(3)
    end

    it "supports lazy evaluation with enumerator methods" do
      enumerator = context.datasets

      # Enumerators are lazy - we can call methods like take without full iteration
      first_two = enumerator.take(2)

      expect(first_two).to eq([dataset1, dataset2])
      expect(first_two.size).to eq(2)
    end

    context "with empty dataset_ids" do
      let(:dataset_ids) { [] }

      it "returns an empty enumerator" do
        expect(context.datasets.to_a).to be_empty
      end

      it "does not update progress" do
        expect(job).not_to receive(:update_progress)
        context.datasets.to_a
      end
    end

    context "with single dataset_id" do
      let(:dataset_ids) { [1] }

      it "updates progress to 1.0" do
        expect(job).to receive(:update_progress).with(1.0)
        context.datasets.to_a
      end
    end
  end
end
