require "spec_helper"

RSpec.describe Context::Crud do
  let(:data) {[]}
  let(:api_mock) { double(:some_api, ) }

  before do
    allow(api_mock).to receive(:index).and_return(data)
  end

  let(:instance) { described_class.new(api_mock) }

  describe "Enumerable behavior" do
    let(:data) { [{ id: "1" }, { id: "2" }, { id: "3" }] }

    it "includes Enumerable module" do
      expect(described_class.ancestors).to include(Enumerable)
    end

    it "delegates each to index when no block given" do
      result = instance.each

      expect(result).to be_a(Enumerator)
      expect(result.to_a).to eq(data)
    end

    it "yields each item when block given" do
      results = []
      instance.each { |item| results << item }

      expect(results).to eq(data)
    end

    it "supports enumerable methods" do
      expect(instance.map { |item| item[:id] }).to eq(["1", "2", "3"])
      expect(instance.select { |item| item[:id] != "2" }).to eq([{ id: "1" }, { id: "3" }])
    end
  end

  describe "#create" do
    it "raises NotImplementedError" do
      expect {
        instance.create({ name: "Test" })
      }.to raise_error(NotImplementedError)
    end
  end

  describe "#index" do
    let(:data) { [{ id: "1", name: "Item 1" }, { id: "2", name: "Item 2" }] }

    context "with no parameters" do
      it "calls the underlying API index method" do
        result = instance.index

        expect(api_mock).to have_received(:index).with(filter: nil)
        expect(result).to eq(data)
      end
    end

    context "with filters" do
      it "merges passed filters with context filters" do
        context_instance = described_class.new(
          api_mock,
          { crud: { context_filter: "value" } }
        )
        context_instance.index(filter: {passed_filter: "other"})

        expect(api_mock).to have_received(:index).with(
          filter: hash_including(context_filter: "value", passed_filter: "other")
        )
      end

      it "uses build_filters to merge filters correctly" do
        instance.index(filter: { status: "active" })

        expect(api_mock).to have_received(:index).with(filter: { status: "active" })
      end
    end

    context "with opts" do
      it "passes opts to the API" do
        instance.index(page: { number: 2, size: 50 })

        expect(api_mock).to have_received(:index).with(
          filter: nil,
          page: { number: 2, size: 50 }
        )
      end

      it "merges opts with context opts" do
        context_instance = described_class.new(
          api_mock,
          nil,
          nil,
          crud: { timeout: 30 }
        )
        context_instance.index(page: { size: 100 })

        expect(api_mock).to have_received(:index).with(
          filter: nil,
          page: { size: 100 },
          timeout: 30
        )
      end
    end

    context "with Api::Exposition" do
      let(:exposition_api) {
        _data = data
        api = Api::Exposition.new(nil, :some_api)
        api.register(:index) {|_| Verse::JsonApi::Struct.new(_data)}
        api
      }
      let(:instance) { described_class.new(exposition_api) }

      before do
        allow(exposition_api).to receive(:index).and_call_original
      end

      it "provides empty filter hash when build_filters returns nil" do
        result = instance.index

        expect(exposition_api).to have_received(:index).with(filter: {})
        expect(result.data).to eq(data)
      end
    end

    context "with context_builder" do
      let(:context_builder) { proc { |result| result.map { |item| item.merge(modified: true) } } }
      let(:instance) { described_class.new(api_mock, nil, nil, &context_builder) }

      it "applies context_builder to the result" do
        result = instance.index

        expect(result.all? { |item| item[:modified] }).to be true
      end
    end

    context "without context_builder" do
      it "returns built result without modification" do
        result = instance.index

        expect(result).to eq(data)
      end
    end
  end

  describe "#show" do
    let(:item) { { id: "123", name: "Test Item" } }
    let(:data) { [item] }

    before do
      allow(instance).to receive(:index).and_call_original
    end

    context "with id parameter" do
      it "calls index with id filter" do
        result = instance.show("123")

        expect(instance).to have_received(:index).with(
          filter: { id: "123" },
          page: { number: 1, size: 1 }
        )
        expect(result).to eq(item)
      end
    end

    context "without id parameter but with context" do
      let(:context_instance) do
        described_class.new(
          api_mock,
          { crud: { id: "123" } }
        )
      end

      before do
        allow(context_instance).to receive(:index).and_call_original
      end

      it "uses id from context" do
        result = context_instance.show

        expect(context_instance).to have_received(:index).with(
          filter: { id: "123" },
          page: { number: 1, size: 1 }
        )
        expect(result).to eq(item)
      end

    end

    context "without any id" do
      it "raises NotFound error" do
        expect {
          instance.show
        }.to raise_error(
          Context::Error::NotFound
        )
      end
    end

    context "when context changes the provided id (security check)" do
      let(:context_instance) do
        described_class.new(
          api_mock,
          { crud: { id: "context-id" } }  # Context forces different ID
        )
      end

      it "raises Forbidden error when user provides different id" do
        expect {
          context_instance.show("user-provided-id")
        }.to raise_error(Context::Error::Forbidden)
      end
    end

    context "when id matches context" do
      let(:context_instance) do
        described_class.new(
          api_mock,
          { crud: { id: "123" } }
        )
      end

      before do
        allow(context_instance).to receive(:index).and_call_original
      end

      it "allows access when provided id matches context id" do
        result = context_instance.show("123")

        expect(result).to eq(item)
      end
    end

    context "pagination" do
      it "always requests page 1, size 1" do
        instance.show("123")

        expect(instance).to have_received(:index).with(
          filter: { id: "123" },
          page: { number: 1, size: 1 }
        )
      end
    end
  end

  describe "#update" do
    it "raises NotImplementedError" do
      expect {
        instance.update({ name: "Updated" }, "123")
      }.to raise_error(NotImplementedError)
    end
  end

  describe "#delete" do
    it "raises NotImplementedError" do
      expect {
        instance.delete("123")
      }.to raise_error(NotImplementedError)
    end
  end

  describe "integration with Context::Base" do
    it "inherits from Context::Base" do
      expect(described_class.ancestors).to include(Context::Base)
    end

    it "has access to build_filters method" do
      expect(instance).to respond_to(:build_filters)
    end

    it "has access to build_opts method" do
      expect(instance).to respond_to(:build_opts)
    end
  end

  describe "real-world usage scenarios" do
    context "multi-tenancy with organization context" do
      let(:org_context) do
        described_class.new(
          api_mock,
          { crud: { id: "1", organization_id: "org-123" } }
        )
      end
      let(:data) { [{ id: "1", organization_id: "org-123" }] }

      it "automatically filters by organization" do
        org_context.index

        expect(api_mock).to have_received(:index).with(
          filter: { id: "1", organization_id: "org-123" }
        )
      end

      it "prevents access to resources outside organization" do
        expect {
          org_context.show("42")  # Different org
        }.to raise_error(Context::Error::Forbidden)
      end
    end

    context "user-scoped queries" do
      let(:user_context) do
        described_class.new(
          api_mock,
          { crud: { user_id: "user-456" } }
        )
      end
      let(:data) { [{ id: "1", user_id: "user-456" }, { id: "2", user_id: "user-456" }] }

      it "scopes all queries to user" do
        user_context.index

        expect(api_mock).to have_received(:index).with(
          filter: { user_id: "user-456" }
        )
      end
    end
  end
end
