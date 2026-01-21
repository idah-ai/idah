require "spec_helper"

RSpec.describe Context::ContextApi::Base do
  let(:api_mock) {
    api = Api::Exposition.new(nil, "some_api")
    api.register(:index) { |_| [] }
    api
  }

  describe "WHITELIST constant" do
    it "includes Api::Exposition" do
      expect(described_class::WHITELIST).to include(Api::Exposition)
    end

    it "includes Base itself" do
      expect(described_class::WHITELIST).to include(Context::ContextApi::Base)
    end

    it "includes CrudProcedural" do
      expect(described_class::WHITELIST).to include(Context::CrudProcedural)
    end

    it "has exactly 3 whitelisted classes" do
      expect(described_class::WHITELIST.size).to eq(3)
    end
  end

  describe "inheritance" do
    it "inherits from Context::CrudEnumerator" do
      expect(described_class.ancestors).to include(Context::CrudEnumerator)
    end
  end

  describe "#initialize" do
    context "with whitelisted API types" do
      it "accepts Api::Exposition" do
        exposition_api = Api::Exposition.new(nil, :test)
        instance = described_class.new(exposition_api)

        expect(instance.send(:__getobj__)).to eq(exposition_api)
      end

      it "accepts Base instance" do
        base_instance = Context::ContextApi::Base.new(api_mock)
        instance = described_class.new(base_instance)

        expect(instance.send(:__getobj__)).to eq(base_instance)
      end

      it "accepts CrudProcedural" do
        crud_proc = Context::CrudProcedural.new(
          :test_crud_procedural,
          proc do |_|
            # nothing
          end
        )
        instance = described_class.new(crud_proc)

        expect(instance.send(:__getobj__)).to eq(crud_proc)
      end
    end

    context "with non-whitelisted API types" do
      it "raises InvalidContext error" do
        invalid_api = double("InvalidApi")
        allow(invalid_api).to receive(:is_a?).and_return(false)

        expect {
          described_class.new(invalid_api)
        }.to raise_error(
          Context::Error::InvalidContext,
          /Base/
        )
      end

      it "rejects random objects" do
        expect {
          described_class.new("not an api")
        }.to raise_error(Context::Error::InvalidContext)
      end

      it "rejects nil when explicitly passed" do
        allow(nil).to receive(:is_a?).and_return(false)

        expect {
          described_class.new(nil)
        }.to raise_error(Context::Error::InvalidContext)
      end
    end

    it "passes args to super" do
      api = api_mock
      args = { test: { id: "123" } }
      instance = described_class.new(api, args)

      expect(instance.instance_variable_get(:@args)).to eq(args)
    end

    it "passes context_args to super" do
      api = api_mock
      context_args = { parent: { org_id: "org-1" } }

      instance = described_class.new(api, nil, context_args)

      expect(instance.instance_variable_get(:@context_args)).to eq(context_args)
    end

    it "passes opts to super" do
      api = api_mock
      opts = { page: { size: 100 } }
      instance = described_class.new(api, nil, nil, **opts)

      expect(instance.instance_variable_get(:@context_opts)).to eq(opts)
    end

    it "passes context_builder block to super" do
      api = api_mock
      builder = proc { |result| result.map(&:upcase) }
      instance = described_class.new(api, nil, nil, &builder)

      expect(instance.instance_variable_get(:@context_builder)).to eq(builder)
    end
  end

  describe "#builder" do
    let(:api) { api_mock }
    let(:instance) { described_class.new(api) }

    before do
    end

    context "with CrudProcedural unit" do
      let(:data_items) { [{ id: "1" }, { id: "2" }] }
      let(:crud_proc_unit) {Context::CrudProcedural.new(:crud_proc_unit,
        proc do |_|
          data_items
        end
      )}
      it "returns lazy mapped result" do
      end

      it "maps over the lazy enumerator" do
        result = instance.builder(crud_proc_unit)

        expect(result).to be_a(Enumerator::Lazy)
        expect(result).to respond_to(:force)
        expect(result.force).to eq(data_items)
      end
    end

    context "with Verse::JsonApi::Struct unit" do
      let(:data) {[
        { id: "1", name: "Item 1" },
        { id: "2", name: "Item 2" }
      ]}
      let(:struct_data) { data.map {|d| Verse::JsonApi::Struct.new(d)} }
      let(:json_struct) { Verse::JsonApi::Struct.new(struct_data) }

      it "extracts data from JsonApi::Struct" do
        result = instance.builder(json_struct)

        expect(result).to be_a(Enumerator::Lazy)
        expect(result).to respond_to(:force)
        expect(result.force).to eq(data)
      end

      context "with errors in response" do
        before do
          allow(json_struct).to receive(:errors).and_return([{ code: "ERROR", message: "Failed" }])
        end

        it "raises QueryFailed error" do
          expect {
            instance.builder(json_struct)
          }.to raise_error(
            Context::Error::QueryFailed,
            /Failed/
          )
        end
      end

      context "with empty data" do
        let(:struct_data) {[]}

        it "returns nil for empty data" do
          result = instance.builder(json_struct)

          expect(result).to be_nil
        end
      end
    end

    context "with Unit" do
      let(:unit) { Context::Unit.new(:some_data) }

      it "returns the unit as-is" do
        result = instance.builder(unit)

        expect(result).to eq(unit)
      end
    end

    context "with other types" do
      let(:regular_data) { [{ id: "1" }, { id: "2" }] }

      it "calls super for regular data" do
        result = instance.builder(regular_data)

        expect(result).to eq(regular_data)
      end
    end
  end

  describe ".root_api" do
    let(:api) { api_mock }

    it "raises NotImplementedError" do
      expect {
        described_class.root_api(api)
      }.to raise_error(NotImplementedError)
    end

    it "raises NotImplementedError with args" do
      expect {
        described_class.root_api(api, { test: "arg" })
      }.to raise_error(NotImplementedError)
    end

    it "is a class method" do
      expect(described_class).to respond_to(:root_api)
    end
  end

  describe "integration with CrudEnumerator" do
    let(:api) { api_mock }
    let(:instance) { described_class.new(api) }

    it "inherits DEFAULT_BATCH_SIZE" do
      expect(described_class::DEFAULT_BATCH_SIZE).to eq(50)
    end

    it "inherits index method" do
      expect(instance).to respond_to(:index)
    end
  end

  describe "real-world usage scenarios" do
    context "with Api::Exposition responses" do
      let(:data) do
        [
          { id: "1", name: "Item 1" },
          { id: "2", name: "Item 2" }
        ]
      end
      let(:json_response) do
        Verse::JsonApi::Struct.new(data.map{ |d|
          Verse::JsonApi::Struct.new(d)
        })
      end
      let(:exposition_api) {
        api = Api::Exposition.new(nil, :test)
        api.register(:index) { |_| json_response }
        api
      }
      let(:instance) { described_class.new(exposition_api) }

      it "processes JsonApi responses" do
        result = instance.builder(json_response)

        expect(result).to be_a(Enumerator::Lazy)
      end

      it "extracts data from nested structure" do
        result = instance.builder(json_response)

        # Force evaluation to check structure
        expect(result).to respond_to(:force)
        expect(result.force).to eq(data)
      end
    end

    context "with CrudProcedural for batched queries" do
      let(:api) { api_mock }
      let(:proc_delegate) do
        Context::CrudProcedural.new(
        "ProcDelegate", proc do |_|
          # [{ id: "batch-1" }, { id: "batch-2" }]
          api_mock.index
        end)
      end
      let(:instance) { described_class.new(proc_delegate) }

      it "handles CrudProcedural results" do
        result = instance.builder(proc_delegate)

        expect(result).to be_a(Enumerator::Lazy)
      end
    end
  end

  describe "edge cases" do
    context "with mixed return types from super" do
      let(:api) { api_mock }
      let(:instance) { described_class.new(api) }

      it "handles nil from super" do
        result = instance.builder(nil)

        expect(result).to be_nil
      end

      it "handles empty arrays from super" do
        result = instance.builder([])

        expect(result).to eq([])
      end
    end

    context "with JsonApi::Struct edge cases" do
      let(:api) { api_mock }
      let(:instance) { described_class.new(api) }
      let(:json_struct) { Verse::JsonApi::Struct.new(nil) }

      it "handles nil errors as success" do
        allow(json_struct).to receive(:errors).and_return(nil)
        allow(json_struct).to receive(:data).and_return([])

        result = instance.builder(json_struct)

        expect(result).to be_nil
      end

      it "raises on any truthy errors" do
        allow(json_struct).to receive(:errors).and_return([{ error: "test" }])

        expect {
          instance.builder(json_struct)
        }.to raise_error(Context::Error::QueryFailed)
      end
    end
  end

  describe "whitelist validation behavior" do
    it "accepts if any whitelist item matches" do
      api = api_mock # base case
      instance = described_class.new(api)
      expect(instance.send(:__getobj__)).to eq(api)

      api = Context::ContextApi::Base.new(api_mock) # transformation Case
      instance = described_class.new(api)
      expect(instance.send(:__getobj__)).to eq(api)

      api = Context::CrudProcedural.new(:test, proc {|i|i}) # delegation Case
      instance = described_class.new(api)
      expect(instance.send(:__getobj__)).to eq(api)
    end

    it "rejects if no whitelist items match" do
      api = Context::Base.new
      expect {
        described_class.new(api)
      }.to raise_error(Context::Error::InvalidContext)
    end
  end
end
