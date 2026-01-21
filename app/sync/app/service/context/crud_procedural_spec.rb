require "spec_helper"

RSpec.describe Context::CrudProcedural do
  let(:proc_mock) do
    proc do |**opts|
      [{ id: "1", name: "Item 1" }, { id: "2", name: "Item 2" }]
    end
  end
  let(:instance) { described_class.new(:test_proc, proc_mock) }

  describe "inheritance" do
    it "inherits from Context::DelegatedProc" do
      expect(described_class.ancestors).to include(Context::DelegatedProc)
    end
  end

  describe "#index" do
    context "when page number is 1" do
      it "calls the proc with opts" do
        result = instance.index(page: { number: 1 })

        expect(result).to eq([{ id: "1", name: "Item 1" }, { id: "2", name: "Item 2" }])
      end

      it "works without page opts" do
        result = instance.index

        expect(result).to eq([{ id: "1", name: "Item 1" }, { id: "2", name: "Item 2" }])
      end

      it "passes all opts to the proc" do
        received_opts = nil
        allow(proc_mock).to receive(:call).and_call_original

        instance.index(filter: { status: "active" }, page: { number: 1, size: 50 })

        expect(proc_mock).to have_received(:call).with(
          filter: { status: "active" },
          page: { number: 1, size: 50 }
        )
      end
    end

    context "when page number is not 1" do
      it "returns nil for page 2" do
        result = instance.index(page: { number: 2 })

        expect(result).to be_nil
      end

      it "returns nil for page 3" do
        result = instance.index(page: { number: 3 })

        expect(result).to be_nil
      end

      it "returns nil for any page > 1" do
        result = instance.index(page: { number: 100 })

        expect(result).to be_nil
      end
    end

    context "when page opts is present but number is not specified" do
      it "treats as page 1 when number is nil" do
        # If page: { size: 50 } but no number, it's treated as first page
        result = instance.index(page: { size: 50 })

        expect(result).to eq([{ id: "1", name: "Item 1" }, { id: "2", name: "Item 2" }])
      end
    end

    context "when page opts is nil or missing" do
      it "treats as page 1 and calls the proc" do
        result = instance.index

        expect(result).to eq([{ id: "1", name: "Item 1" }, { id: "2", name: "Item 2" }])
      end
    end
  end

  describe "proc behavior" do
    context "with different proc implementations" do
      it "works with proc that returns data immediately" do
        simple_proc = proc { [{ id: "simple" }] }
        instance = described_class.new(:simple, simple_proc)

        result = instance.index

        expect(result).to eq([{ id: "simple" }])
      end

      it "works with proc that uses opts to filter" do
        filtering_proc = proc do |opts|
          filter = opts[:filter] || {}
          data = [
            { id: "1", status: "active" },
            { id: "2", status: "inactive" }
          ]
          data.select { |item| !filter[:status] || item[:status] == filter[:status] }
        end
        instance = described_class.new(:filtering, filtering_proc)

        result = instance.index(filter: { status: "active" })

        expect(result).to eq([{ id: "1", status: "active" }])
      end

      it "works with proc that returns enumerator" do
        enum_proc = proc { [{ id: "1" }, { id: "2" }].lazy }
        instance = described_class.new(:enumerator, enum_proc)

        result = instance.index

        expect(result).to be_a(Enumerator::Lazy)
        expect(result.to_a).to eq([{ id: "1" }, { id: "2" }])
      end
    end

    context "with proc that returns nil" do
      it "handles nil return value" do
        nil_proc = proc { nil }
        instance = described_class.new(:nil_proc, nil_proc)

        result = instance.index

        expect(result).to be_nil
      end
    end

    context "with proc that returns empty array" do
      it "handles empty array return value" do
        empty_proc = proc { [] }
        instance = described_class.new(:empty, empty_proc)

        result = instance.index

        expect(result).to eq([])
      end
    end
  end

  describe "integration with DelegatedProc" do
    it "requires a callable object" do
      expect {
        described_class.new(:test, "not a proc")
      }.to raise_error(Context::Error::InvalidContext)
    end

    it "stores the proc as delegated object" do
      instance = described_class.new(:test, proc_mock)

      expect(instance.send(:__getobj__)).to eq(proc_mock)
    end

    it "stores the name" do
      instance = described_class.new(:custom_name, proc_mock)

      expect(instance.name).to eq(:custom_name)
    end
  end

  describe "real-world usage scenarios" do
    context "batched queries from parent collection" do
      # This simulates Datasets.from_projects pattern
      let(:projects) { [{ id: "proj-1" }, { id: "proj-2" }, { id: "proj-3" }] }
      let(:batched_proc) do
        project_ids = projects.map { |p| p[:id] }
        proc do |**opts|
          # Simulate fetching datasets for multiple projects
          project_ids.flat_map do |proj_id|
            [
              { id: "#{proj_id}-ds-1", project_id: proj_id },
              { id: "#{proj_id}-ds-2", project_id: proj_id }
            ]
          end
        end
      end
      let(:instance) { described_class.new(:datasets, batched_proc) }

      it "returns all batched results on first page" do
        result = instance.index

        expect(result.size).to eq(6)  # 2 datasets per 3 projects
        expect(result.map { |ds| ds[:project_id] }.uniq).to contain_exactly("proj-1", "proj-2", "proj-3")
      end

      it "returns nil on subsequent pages" do
        result = instance.index(page: { number: 2 })

        expect(result).to be_nil
      end
    end

    context "with chunk_iterator integration" do
      # Simulates the pattern in from_projects/from_organizations
      let(:organization_ids) { ["org-1", "org-2", "org-3"].each_slice(1) }
      let(:iterator_proc) do
        proc do |**opts|
          Verse::Util::Iterator.chunk_iterator do |chunk_num|
            begin
              org_id = organization_ids.next.first
              [
                { id: "proj-#{chunk_num}-1", organization_id: org_id },
                { id: "proj-#{chunk_num}-2", organization_id: org_id }
              ]
            rescue StopIteration
              nil
            end
          end
        end
      end
      let(:instance) { described_class.new(:projects, iterator_proc) }

      it "returns the chunk iterator on first page" do
        result = instance.index

        expect(result).to be_a(Enumerator)
      end

      it "returns nil on page 2" do
        result = instance.index(page: { number: 2 })

        expect(result).to be_nil
      end
    end

  end

  describe "edge cases" do
    context "when proc raises an error" do
      let(:error_proc) { proc { raise StandardError, "Something went wrong" } }
      let(:instance) { described_class.new(:error_test, error_proc) }

      it "propagates the error" do
        expect {
          instance.index
        }.to raise_error(StandardError, "Something went wrong")
      end
    end

    context "when proc returns unexpected types" do
      it "returns string if proc returns string" do
        string_proc = proc { "string result" }
        instance = described_class.new(:string, string_proc)

        result = instance.index

        expect(result).to eq("string result")
      end

      it "returns hash if proc returns hash" do
        hash_proc = proc { { key: "value" } }
        instance = described_class.new(:hash, hash_proc)

        result = instance.index

        expect(result).to eq({ key: "value" })
      end
    end

    context "with page number edge cases" do
      it "returns nil for page 0" do
        result = instance.index(page: { number: 0 })

        expect(result).to be_nil
      end

      it "returns nil for negative page numbers" do
        result = instance.index(page: { number: -1 })

        expect(result).to be_nil
      end
    end
  end

  describe "call delegation" do
    it "can call the proc directly via __getobj__" do
      result = instance.send(:__getobj__).call

      expect(result).to eq([{ id: "1", name: "Item 1" }, { id: "2", name: "Item 2" }])
    end
  end
end
