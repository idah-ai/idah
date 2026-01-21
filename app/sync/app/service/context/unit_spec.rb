RSpec.describe Context::Unit do
  let(:unit_data) { { id: "unit-1", name: "Test Unit" } }
  let(:context_obj) { double("Context", name: :test_context) }

  describe "#initialize" do
    context "with unit data only" do
      it "wraps unit data" do
        instance = described_class.new(unit_data)

        expect(instance.send(:__getobj__)).to eq(unit_data)
      end
    end

    context "with context parameter" do
      it "converts non-Context object to Context" do
        context_with_no_name = double("ContextWithName")
        expect(Context).to receive(:new).with(context_with_no_name).and_call_original

        described_class.new(unit_data, context_with_no_name)
      end

      it "doesn't convert if already has name method" do
        # Should not call Context.new
        expect(Context).not_to receive(:new)

        described_class.new(unit_data, context_obj)
      end
    end

    context "with single context" do
      it "creates instance variable for context" do
        instance = described_class.new(unit_data, context_obj)

        expect(instance.instance_variable_get(:@test_context)).to eq(context_obj)
      end

      it "creates attr_reader for context" do
        instance = described_class.new(unit_data, context_obj)

        expect(instance).to respond_to(:test_context)
        expect(instance.test_context).to eq(context_obj)
      end
    end

    context "with array of contexts" do
      let(:context1) { double("Context1", name: :ctx1) }
      let(:context2) { double("Context2", name: :ctx2) }
      let(:contexts) { [context1, context2] }

      it "creates instance variables for all contexts" do
        instance = described_class.new(unit_data, contexts)

        expect(instance.instance_variable_get(:@ctx1)).to eq(context1)
        expect(instance.instance_variable_get(:@ctx2)).to eq(context2)
      end

      it "creates attr_readers for all contexts" do
        instance = described_class.new(unit_data, contexts)

        expect(instance.ctx1).to eq(context1)
        expect(instance.ctx2).to eq(context2)
      end
    end

    context "with Crud context" do
      let(:api) {
        api = Data.define(:name) do
          def index(_)
            []
          end
        end.new('crud_context')
      }
      let(:crud_context) {Context::Crud.new(api)}

      it "handles Crud contexts correctly" do
        instance = described_class.new(unit_data, crud_context)

        expect(instance.crud_context).to eq(crud_context)
      end
    end

    it "passes args to super" do
      args = { test: { filter: "active" } }
      instance = described_class.new(unit_data, nil, args)

      expect(instance.instance_variable_get(:@args)).to eq(args)
    end

    it "passes filters (context_args) to super" do
      filters = { parent: { id: "parent-1" } }
      instance = described_class.new(unit_data, nil, nil, filters)

      expect(instance.instance_variable_get(:@context_args)).to eq(filters)
    end

    it "passes opts to super" do
      opts = { page: { size: 100 } }
      instance = described_class.new(unit_data, nil, nil, nil, **opts)

      expect(instance.instance_variable_get(:@context_opts)).to eq(opts)
    end
  end

  describe "#index" do
    it "returns array with the unit data" do
      instance = described_class.new(unit_data)

      result = instance.index

      expect(result).to eq([unit_data])
    end

    it "ignores any opts passed" do
      instance = described_class.new(unit_data)

      result = instance.index(page: { number: 5, size: 100 })

      expect(result).to eq([unit_data])
    end
  end

  describe "#show" do
    it "returns the unit data directly" do
      instance = described_class.new(unit_data)

      result = instance.show

      expect(result).to eq(unit_data)
    end
  end

  describe "real-world usage" do
    context "wrapping API response with related contexts" do
      let(:project_data) { { id: "proj-1", name: "Project Alpha" } }
      let(:datasets_context) { double("Datasets", name: :datasets) }
      let(:members_context) { double("Members", name: :members) }

      it "creates a unit with multiple related contexts" do
        instance = described_class.new(
          project_data,
          [datasets_context, members_context]
        )

        expect(instance.show).to eq(project_data)
        expect(instance.datasets).to eq(datasets_context)
        expect(instance.members).to eq(members_context)
      end
    end

    context "accessing unit data and related resources" do
      let(:dataset_data) { { id: "ds-1", project_id: "proj-1" } }
      let(:entries_context) { double("Entries", name: :entries) }

      it "allows accessing both data and contexts" do
        instance = described_class.new(dataset_data, entries_context)

        # Access unit data
        expect(instance.show[:id]).to eq("ds-1")

        # Access related context
        expect(instance.entries).to eq(entries_context)
      end
    end
  end

  describe "edge cases" do
    context "with nil unit data" do
      it "accepts nil as unit data" do
        instance = described_class.new(nil)

        expect(instance.show).to be_nil
      end
    end

    context "with empty contexts array" do
      it "accepts empty array" do
        instance = described_class.new(unit_data, [])

        expect(instance.show).to eq(unit_data)
      end
    end

    context "with nil context" do
      it "handles nil context gracefully" do
        instance = described_class.new(unit_data, nil)

        expect(instance.show).to eq(unit_data)
      end
    end
  end
end
