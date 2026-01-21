require "spec_helper"

RSpec.describe Context::CrudEnumerator do
  let(:api_mock) { double("ApiMock") }
  let(:instance) { described_class.new(api_mock) }

  before do
    allow(api_mock).to receive(:index).with(any_args)
  end

  describe "DEFAULT_BATCH_SIZE" do
    it "is defined as 50" do
      expect(described_class::DEFAULT_BATCH_SIZE).to eq(50)
    end
  end

  describe "inheritance" do
    it "inherits from Context::Crud" do
      expect(described_class.ancestors).to include(Context::Crud)
    end
  end

  describe "#index" do
    let(:page_1_data) { [{ id: "1" }, { id: "2" }] }
    let(:page_2_data) { [{ id: "3" }, { id: "4" }] }
    let(:page_3_data) { [{ id: "5" }] }

    before do
      # Mock parent's index to track calls
      call_count = 0
      allow(api_mock).to receive(:index) do |page:, **opts|
        call_count += 1
        case Hash(page)[:number]
        when 1 then page_1_data
        when 2 then page_2_data
        when 3 then page_3_data
        else nil
        end
      end
    end

    context "without pagination options" do
      it "returns a chunk iterator" do
        result = instance.index

        expect(result).to be_a(Enumerator)
      end

      it "uses DEFAULT_BATCH_SIZE for page size" do
        result = instance.index

        # Force enumeration to trigger the iterator
        first = result.first

        # Verify super was called with correct page size
        expect(api_mock).to have_received(:index).with(
          hash_including(page: { number: 1, size: 50 })
        )
      end

      it "iterates through all pages" do
        result = instance.index.to_a

        # Should have fetched all 3 pages
        expect(result).to eq([
          { id: "1" }, { id: "2" },
          { id: "3" }, { id: "4" },
          { id: "5" }
        ])
      end

      it "increments page number for each chunk" do
        instance.index.to_a

        # Should have called with pages 1, 2, 3, #4 nil
        expect(api_mock).to have_received(:index).exactly(4).times
      end
    end

    context "with custom page size" do
      it "uses provided page size instead of default" do
        result = instance.index(page: { size: 100 })
        result.first

        expect(api_mock).to have_received(:index).with(
          hash_including(page: { number: 1, size: 100 })
        )
      end
    end

    context "with filters" do
      it "passes filters to each page request" do
        result = instance.index(filter: { status: "active" })
        result.take(3).to_a

        # All page requests should include the filter
        expect(api_mock).to have_received(:index).with(
          hash_including(filter: { status: "active" })
        ).at_least(:once)
      end
    end

    context "with opts" do
      it "passes opts to each page request" do
        result = instance.index(page: { size: 25 }, timeout: 30)
        result.first

        expect(api_mock).to have_received(:index).with(
          hash_including(page: { number: 1, size: 25 }, timeout: 30)
        )
      end
    end

    context "lazy evaluation" do
      it "only fetches pages as needed" do
        result = instance.index

        # No calls yet
        expect(api_mock).not_to have_received(:index)

        # Fetch first page
        first = result.first

        # Should have only called once
        expect(api_mock).to have_received(:index).once
      end

      it "fetches subsequent pages on demand" do
        result = instance.index

        # Take first 3 items (crosses into page 2)
        result.take(3).to_a

        # Should have fetched pages 1 and 2
        expect(api_mock).to have_received(:index).twice
      end
    end

    context "when a page returns nil" do
      before do
        call_count = 0
        allow(api_mock).to receive(:index) do |_, **opts|
          call_count += 1
          call_count == 1 ? page_1_data : nil
        end
      end

      it "stops iteration when nil is returned" do
        result = instance.index.to_a

        expect(result).to eq(page_1_data)
      end
    end
  end

  describe "integration with Verse::Util::Iterator" do
    it "uses chunk_iterator for pagination" do
      allow(Verse::Util::Iterator).to receive(:chunk_iterator).and_call_original

      instance.index.first

      expect(Verse::Util::Iterator).to have_received(:chunk_iterator)
    end
  end

  describe "real-world scenarios" do
    context "paginating through large dataset" do
      let(:total_items) { 250 }
      let(:all_items) do
        (1..total_items).map { |i| { id: i.to_s } }
      end

      before do
        # Simulate API that returns 50 items per page
        allow(api_mock).to receive(:index) do |_, **opts|
          page_num = opts.dig(:page, :number) || 1
          page_size = opts.dig(:page, :size) || 50

          start_idx = (page_num - 1) * page_size
          end_idx = start_idx + page_size - 1

          if start_idx >= total_items
            nil
          else
            all_items[start_idx..end_idx]
          end
        end
      end

      it "fetches all items across multiple pages" do
        result = instance.index.to_a

        expect(result.size).to eq(total_items)
        expect(result.first[:id]).to eq("1")
        expect(result.last[:id]).to eq("250")
      end

      it "respects custom batch sizes" do
        result = instance.index(page: { size: 100 }).to_a

        expect(result.size).to eq(total_items)
        # Should have made 4 requests (100 + 100 + 50 + 0)
        expect(api_mock).to have_received(:index).exactly(4).times
      end

      it "allows early termination with take" do
        result = instance.index.take(75).to_a

        expect(result.size).to eq(75)
        # Should have made 2 requests (50 + 50, but stopped after 75 items)
        expect(api_mock).to have_received(:index).twice
      end
    end

    context "with context filters" do
      let(:context_instance) do
        described_class.new(
          api_mock,
          { resources: { organization_id: "org-123" } }
        )
      end
      let(:org_items) do
        (1..100).map { |i| { id: i.to_s, organization_id: "org-123" } }
      end

      before do
        allow(api_mock).to receive(:index) do |_, **opts|
          page_num = opts.dig(:page, :number) || 1
          page_size = opts.dig(:page, :size) || 50

          start_idx = (page_num - 1) * page_size
          end_idx = start_idx + page_size - 1

          if start_idx >= org_items.size
            nil
          else
            org_items[start_idx..end_idx]
          end
        end
      end

      it "applies context filters to all pages" do
        result = context_instance.index.to_a

        expect(result.all? { |item| item[:organization_id] == "org-123" }).to be true
        expect(result.size).to eq(100)
      end
    end

    context "combining filters and pagination" do
      let(:active_items) { (1..75).map { |i| { id: i.to_s, status: "active" } } }

      before do
        allow(api_mock).to receive(:index) do |_, **opts|
          page_num = opts.dig(:page, :number) || 1
          page_size = opts.dig(:page, :size) || 50
          filter = opts[:filter] || {}

          # Only return items matching filter
          return nil if filter[:status] && filter[:status] != "active"

          start_idx = (page_num - 1) * page_size
          end_idx = start_idx + page_size - 1

          if start_idx >= active_items.size
            nil
          else
            active_items[start_idx..end_idx]
          end
        end
      end

      it "combines filters with pagination" do
        result = instance.index(filter: { status: "active" }).to_a

        expect(result.size).to eq(75)
        expect(result.all? { |item| item[:status] == "active" }).to be true
      end
    end
  end

  describe "edge cases" do
    context "when first page is nil" do
      before do
        allow(api_mock).to receive(:index).and_return(nil)
      end

      it "returns empty enumerator" do
        result = instance.index.to_a

        expect(result).to eq([])
      end
    end

    context "with exactly DEFAULT_BATCH_SIZE items" do
      let(:exact_batch) { (1..50).map { |i| { id: i.to_s } } }

      before do
        call_count = 0
        allow(api_mock).to receive(:index) do |_, **opts|
          call_count += 1
          call_count == 1 ? exact_batch : nil
        end
      end

      it "fetches two page" do
        result = instance.index.to_a

        expect(result.size).to eq(50)
        expect(api_mock).to have_received(:index).twice # second one for closure
      end
    end
  end
end
