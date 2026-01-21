require "spec_helper"

RSpec.describe Context::DelegatedProc do
  let(:test_proc) { proc { [{ id: "1" }, { id: "2" }] } }

  describe "inheritance" do
    it "inherits from Context::Delegated" do
      expect(described_class.ancestors).to include(Context::Delegated)
    end
  end

  describe "#initialize" do
    context "with valid callable object" do
      it "accepts a proc" do
        instance = described_class.new(:test_name, test_proc)

        expect(instance.send(:__getobj__)).to eq(test_proc)
        expect(instance.name).to eq(:test_name)
      end

      it "accepts a lambda" do
        test_lambda = lambda { [{ id: "lambda" }] }
        instance = described_class.new(:lambda_test, test_lambda)

        expect(instance.send(:__getobj__)).to eq(test_lambda)
      end

      it "accepts any object that responds to call" do
        callable = double("Callable")
        allow(callable).to receive(:respond_to?).with(:call).and_return(true)

        instance = described_class.new(:callable_test, callable)

        expect(instance.send(:__getobj__)).to eq(callable)
      end
    end

    context "with invalid (non-callable) object" do
      it "raises InvalidContext for string" do
        expect {
          described_class.new(:test, "not callable")
        }.to raise_error(Context::Error::InvalidContext)
      end

      it "raises InvalidContext for number" do
        expect {
          described_class.new(:test, 123)
        }.to raise_error(Context::Error::InvalidContext)
      end

      it "raises InvalidContext for hash" do
        expect {
          described_class.new(:test, { key: "value" })
        }.to raise_error(Context::Error::InvalidContext)
      end

      it "raises InvalidContext for array" do
        expect {
          described_class.new(:test, [1, 2, 3])
        }.to raise_error(Context::Error::InvalidContext)
      end

      it "raises InvalidContext for object without call method" do
        non_callable = double("NonCallable")
        allow(non_callable).to receive(:respond_to?).with(:call).and_return(false)

        expect {
          described_class.new(:test, non_callable)
        }.to raise_error(Context::Error::InvalidContext)
      end

      it "raises InvalidContext for nil" do
        expect {
          described_class.new(:test, nil)
        }.to raise_error(Context::Error::InvalidContext)
      end
    end

    it "passes name as first parameter to super" do
      instance = described_class.new(:my_proc, test_proc)

      expect(instance.name).to eq(:my_proc)
    end

    it "passes proc as delegated_obj (second parameter) to super" do
      instance = described_class.new(:test, test_proc)

      expect(instance.send(:__getobj__)).to eq(test_proc)
    end

    it "passes args to super" do
      args = { test: { filter: "active" } }
      instance = described_class.new(:test, test_proc, args)

      expect(instance.instance_variable_get(:@args)).to eq(args)
    end

    it "passes context_args to super" do
      context_args = { parent: { id: "parent-1" } }
      instance = described_class.new(:test, test_proc, nil, context_args)

      expect(instance.instance_variable_get(:@context_args)).to eq(context_args)
    end

    it "passes opts to super" do
      opts = { page: { size: 100 } }
      instance = described_class.new(:test, test_proc, nil, nil, **opts)

      expect(instance.instance_variable_get(:@context_opts)).to eq(opts)
    end

    it "handles all parameters together" do
      args = { test: { status: "active" } }
      context_args = { parent: { org_id: "org-123" } }
      opts = { timeout: 60 }

      instance = described_class.new(:complete, test_proc, args, context_args, **opts)

      expect(instance.name).to eq(:complete)
      expect(instance.send(:__getobj__)).to eq(test_proc)
      expect(instance.instance_variable_get(:@args)).to eq(args)
      expect(instance.instance_variable_get(:@context_args)).to eq(context_args)
      expect(instance.instance_variable_get(:@context_opts)).to eq(opts)
    end
  end

  describe "parameter order in initialize" do
    it "requires name as first parameter" do
      instance = described_class.new(:first_param, test_proc)

      expect(instance.name).to eq(:first_param)
    end

    it "requires callable as second parameter" do
      instance = described_class.new(:name, test_proc)

      expect(instance.send(:__getobj__)).to eq(test_proc)
    end

    it "follows pattern: name, proc, args, context_args, **opts" do
      instance = described_class.new(
        :datasets,                              # name
        test_proc,                              # delegated_proc
        { datasets: { project_id: "proj-1" } }, # args
        { projects: { id: "proj-1" } },         # context_args
        page: { size: 50 }                      # **opts
      )

      expect(instance.name).to eq(:datasets)
      expect(instance.send(:__getobj__)).to eq(test_proc)
      expect(instance.instance_variable_get(:@args)[:datasets]).to eq({ project_id: "proj-1" })
    end
  end

  describe "integration with Context::Delegated" do
    it "inherits name method from Delegated" do
      instance = described_class.new(:custom_name, test_proc)

      expect(instance.name).to eq(:custom_name)
    end

    it "can access delegated proc via __getobj__" do
      instance = described_class.new(:test, test_proc)

      result = instance.send(:__getobj__).call
      expect(result).to eq([{ id: "1" }, { id: "2" }])
    end
  end

  describe "real-world usage scenarios" do
    context "wrapping data generation procs" do
      let(:generator_proc) do
        proc do |**opts|
          count = opts.dig(:page, :size) || 10
          (1..count).map { |i| { id: i.to_s, generated: true } }
        end
      end

      it "creates a named generator" do
        instance = described_class.new(:generator, generator_proc)

        expect(instance.name).to eq(:generator)
        result = instance.send(:__getobj__).call(page: { size: 5 })
        expect(result.size).to eq(5)
      end
    end

    context "from_projects/from_organizations pattern" do
      # This simulates how CrudProcedural is used in ContextApi
      let(:project_ids) { ["proj-1", "proj-2", "proj-3"] }
      let(:batched_proc) do
        ids = project_ids.dup
        proc do |**opts|
          Verse::Util::Iterator.chunk_iterator do |chunk|
            begin
              id_batch = ids.shift(2)  # Batch of 2
              return nil if id_batch.empty?

              id_batch.flat_map do |proj_id|
                [
                  { id: "#{proj_id}-ds-1", project_id: proj_id },
                  { id: "#{proj_id}-ds-2", project_id: proj_id }
                ]
              end
            rescue => e
              nil
            end
          end
        end
      end

      it "wraps complex batching logic with a name" do
        instance = described_class.new(:datasets_from_projects, batched_proc)

        expect(instance.name).to eq(:datasets_from_projects)
        result = instance.send(:__getobj__).call
        expect(result).to be_a(Enumerator)
      end
    end

    context "with context propagation" do
      let(:filtering_proc) do
        proc do |**opts|
          filter = opts[:filter] || {}
          data = [
            { id: "1", org_id: "org-123" },
            { id: "2", org_id: "org-456" }
          ]
          data.select { |item| !filter[:org_id] || item[:org_id] == filter[:org_id] }
        end
      end

      it "can pass context to proc through args" do
        instance = described_class.new(
          :filtered_data,
          filtering_proc,
          { filtered_data: { org_id: "org-123" } }
        )

        # The proc would receive filters through the CRUD methods
        expect(instance.name).to eq(:filtered_data)
        expect(instance.instance_variable_get(:@args)).to include(
          filtered_data: { org_id: "org-123" }
        )
      end
    end
  end

  describe "different callable types" do
    context "with Method object" do
      class CallableExample
        def self.my_method(**opts)
          [{ from: "method" }]
        end
      end

      it "accepts Method objects" do
        method_obj = CallableExample.method(:my_method)
        instance = described_class.new(:method_test, method_obj)

        result = instance.send(:__getobj__).call
        expect(result).to eq([{ from: "method" }])
      end
    end

    context "with custom callable class" do
      class CustomCallable
        def call(**opts)
          [{ from: "custom_callable" }]
        end
      end

      it "accepts objects with call method" do
        callable = CustomCallable.new
        instance = described_class.new(:custom, callable)

        result = instance.send(:__getobj__).call
        expect(result).to eq([{ from: "custom_callable" }])
      end
    end
  end

  describe "edge cases" do
    context "with proc that raises errors" do
      let(:error_proc) { proc { raise StandardError, "Proc error" } }

      it "stores the proc even if it would raise" do
        instance = described_class.new(:error_test, error_proc)

        expect(instance.send(:__getobj__)).to eq(error_proc)
        expect {
          instance.send(:__getobj__).call
        }.to raise_error(StandardError, "Proc error")
      end
    end

    context "with proc that returns various types" do
      it "accepts proc returning nil" do
        nil_proc = proc { nil }
        instance = described_class.new(:nil_test, nil_proc)

        expect(instance.send(:__getobj__).call).to be_nil
      end

      it "accepts proc returning empty array" do
        empty_proc = proc { [] }
        instance = described_class.new(:empty_test, empty_proc)

        expect(instance.send(:__getobj__).call).to eq([])
      end

      it "accepts proc returning enumerator" do
        enum_proc = proc { (1..3).lazy }
        instance = described_class.new(:enum_test, enum_proc)

        expect(instance.send(:__getobj__).call).to be_a(Enumerator::Lazy)
      end
    end

    context "with lambda vs proc" do
      it "handles lambda with strict argument checking" do
        strict_lambda = lambda { |x| [{ value: x }] }
        instance = described_class.new(:lambda_test, strict_lambda)

        result = instance.send(:__getobj__).call("test")
        expect(result).to eq([{ value: "test" }])
      end

      it "handles proc with flexible argument handling" do
        flexible_proc = proc { |x| [{ value: x }] }
        instance = described_class.new(:proc_test, flexible_proc)

        # Procs don't raise on extra arguments
        result = instance.send(:__getobj__).call("test", "extra")
        expect(result).to eq([{ value: "test" }])
      end
    end
  end

  describe "validation timing" do
    it "validates callability immediately on initialization" do
      # Should fail fast, not lazy
      expect {
        described_class.new(:test, "not callable")
      }.to raise_error(Context::Error::InvalidContext)
    end

    it "doesn't call the proc during initialization" do
      call_count = 0
      counting_proc = proc { call_count += 1; [] }

      described_class.new(:counter, counting_proc)

      expect(call_count).to eq(0)
    end
  end
end
