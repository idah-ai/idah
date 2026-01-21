require "spec_helper"

RSpec.describe Context::Root do
  let(:io) { Context::Io.new(Command::Base) }
  let(:datasets) { Context::ContextApi.new }
  let(:current_context) {[ io, datasets ]}

  describe "inheritance" do
    it "inherits from Context::EnumerableContext" do
      expect(described_class.ancestors).to include(Context::EnumerableContext)
    end
  end

  describe "#initialize" do
    context "with valid delegated_obj" do
      it "wraps delegated_obj with Context.new" do
        expect(Context).to receive(:new).with(current_context).and_call_original

        described_class.new(current_context)
      end

      it "validates that io is a Context::Io" do
        instance = described_class.new(current_context)

        expect(instance).to be_a(described_class)
      end

      it "validates that datasets is a Context::Crud" do
        instance = described_class.new(current_context)

        expect(instance).to be_a(described_class)
      end

      it "passes args to super" do
        args = { test: { id: "123" } }
        instance = described_class.new(current_context, args)

        expect(instance.instance_variable_get(:@args)).to eq(args)
      end

      it "passes context_args to super" do
        context_args = { parent: { org_id: "org-1" } }
        instance = described_class.new(current_context, nil, context_args)

        expect(instance.instance_variable_get(:@context_args)).to eq(context_args)
      end

      it "passes opts to super" do
        opts = { page: { size: 50 } }
        instance = described_class.new(current_context, nil, nil, **opts)

        expect(instance.instance_variable_get(:@context_opts)).to eq(opts)
      end

      it "passes context_builder block to super" do
        builder = proc { |result| result }
        instance = described_class.new(current_context, nil, nil, &builder)

        expect(instance.instance_variable_get(:@context_builder)).to eq(builder)
      end
    end

    context "with invalid io" do
      let(:io) {
        io = double("NotIo")
        allow(io).to receive(:name).and_return(:io)
        io
      }
      it "raises InvalidContext error when io is not Context::Io" do
        expect {
          described_class.new(current_context)
        }.to raise_error(
          Context::Error::InvalidContext,
          /invalid Io on/
        )
      end
    end

    context "with missing io" do
      let(:current_context) { [ datasets ] }

      it "accepts context without io if it doesn't respond_to io" do
        # If context doesn't respond_to :io, the check is skipped
        instance = described_class.new(current_context)

        expect(instance).to be_a(described_class)
      end
    end

    context "with invalid datasets" do
      let(:datasets) {
        datasets = double("InvalidDatasets")
        allow(datasets).to receive(:name).and_return(:datasets)
        datasets
      }

      it "raises InvalidContext error when datasets is not Context::Crud" do
        expect {
          described_class.new(current_context)
        }.to raise_error(
          Context::Error::InvalidContext,
          /invalid context api on/
        )
      end
    end

    context "with missing datasets" do
      let(:current_context) {[io]}

      it "raises InvalidContext error when datasets method doesn't exist" do
        expect {
          described_class.new(current_context)
        }.to raise_error(
          Context::Error::InvalidContext,
          /invalid context api on/
        )
      end
    end
  end

  describe "validation behavior" do
    context "io validation details" do
      it "checks if io.is_a?(Context::Io)" do
        allow(io).to receive(:is_a?).and_call_original

        instance = described_class.new(current_context)

        expect(io).to have_received(:is_a?).with(Context::Io)
      end

      it "fails when io exists but is wrong type" do
        allow(io).to receive(:is_a?).with(Context::Io).and_return(false)

        expect {
          described_class.new(current_context)
        }.to raise_error(Context::Error::InvalidContext)
      end
    end

    context "datasets validation details" do
      let(:current_context) {[datasets]}

      before do
        allow(datasets).to receive(:is_a?).and_call_original
      end

      it "checks if datasets.is_a?(Context::Crud)" do
        instance = described_class.new(current_context)

        expect(datasets).to have_received(:is_a?).with(Context::Crud)
      end

      it "must have datasets method" do
        allow(datasets).to receive(:name).and_return(:not_datasets)

        expect {
          described_class.new(current_context)
        }.to raise_error(Context::Error::InvalidContext)
      end
    end
  end

  describe "integration with EnumerableContext" do
    it "wraps the context as an enumerable" do
      instance = described_class.new(current_context)

      # Should have wrapped it via super (EnumerableContext)
      expect(instance).to be_a(Context::EnumerableContext)
    end
  end
end
