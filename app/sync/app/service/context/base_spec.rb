require "spec_helper"

RSpec.describe Context::Base do
  let(:delegated_obj) { double(name: :test_api) }

  describe "initialization" do
    it "stores all initialization parameters" do
      args = { test_api: { key: 'value' } }
      context_args = { test_api: { other: 'data' } }
      opts = { test_api: { option: 'setting' } }

      instance = described_class.new(delegated_obj, args, context_args, opts)

      expect(instance.send("__getobj__")).to eq(delegated_obj)
      expect(instance.instance_variable_get(:@args)).to eq(args)
      expect(instance.instance_variable_get(:@context_args)).to eq(context_args)
      expect(instance.instance_variable_get(:@context_opts)).to eq(opts)
    end

    it "works with minimal parameters" do
      instance = described_class.new(delegated_obj)

      expect(instance.send("__getobj__")).to eq(delegated_obj)
      expect(instance.instance_variable_get(:@args)).to be_nil
      expect(instance.instance_variable_get(:@context_args)).to be_nil
      expect(instance.instance_variable_get(:@opts)).to be_nil
    end
  end

  describe "#name" do
    it "delegates to wrapped object's name method" do
      expect(described_class.new(delegated_obj).name).to eq(:test_api)
    end

    it "falls back to class name when object doesn't respond to name" do
      nameless = double()
      instance = described_class.new(nameless)
      expect(instance.name).to eq(:base)
    end
  end

  describe ".build_filters" do
    context "with precedence hierarchy" do
      # Precedence: passed_filters < passed_context_args < passed_args
      let(:passed_filters) { { key1: 'from_filters', key2: 'from_filters' } }
      let(:passed_context_args) { { test_api: { key2: 'from_context_args', key3: 'from_context_args' } } }
      let(:passed_args) { { test_api: { key3: 'from_args', key4: 'from_args' } } }

      it "applies correct precedence: filters < context_args < args" do
        result = described_class.build_filters(
          passed_filters,
          :test_api,
          passed_args,
          passed_context_args
        )

        expect(result).to eq(
          key1: 'from_filters',        # Only in filters
          key2: 'from_context_args',   # context_args overrides filters
          key3: 'from_args',           # args overrides context_args (highest)
          key4: 'from_args'            # Only in args
        )
      end
    end

    context "with nil and empty inputs" do
      it "returns nil when all inputs are nil" do
        result = described_class.build_filters(nil, :test_api, nil, nil)
        expect(result).to be_nil
      end

      it "returns nil when all inputs are empty hashes" do
        result = described_class.build_filters({}, :test_api, {}, {})
        expect(result).to be_nil
      end

      it "handles mix of nil and populated hashes" do
        result = described_class.build_filters(
          { key: 'value' },
          :test_api,
          nil,
          { test_api: { other: 'data' } }
        )

        expect(result).to eq(key: 'value', other: 'data')
      end
    end

    context "with non-existent API names" do
      it "returns only passed_filters when API not in contextualized hashes" do
        result = described_class.build_filters(
          { key: 'value' },
          :non_existent_api,
          { test_api: { other: 'data' } },
          { test_api: { another: 'value' } }
        )

        expect(result).to eq(key: 'value')
      end
    end

    context "with various data types" do
      it "handles non-string values correctly" do
        result = described_class.build_filters(
          { int: 123, bool: true, nil_val: nil, array: [1, 2] },
          :test_api,
          { test_api: { hash: { nested: 'value' } } },
          { test_api: { symbol: :sym } }
        )

        expect(result).to include(
          int: 123,
          bool: true,
          nil_val: nil,
          array: [1, 2],
          hash: { nested: 'value' },
          symbol: :sym
        )
      end
    end
  end

  describe "#build_filters" do
    let(:instance_args) { { test_api: { key1: 'instance_args', key2: 'instance_args' } } }
    let(:instance_context_args) { { test_api: { key2: 'instance_context', key3: 'instance_context' } } }
    let(:instance) { described_class.new(delegated_obj, instance_args, instance_context_args) }

    context "with precedence including instance variables" do
      # Precedence: passed_filters < passed_context_args < @context_args < passed_args < @args
      let(:passed_filters) { { key1: 'p_filters', key5: 'p_filters' } }
      let(:passed_context_args) { { test_api: { key3: 'p_context', key4: 'p_context' } } }
      let(:passed_args) { { test_api: { key4: 'p_args' } } }

      it "applies full precedence with instance vars highest" do
        result = instance.build_filters(passed_filters, :test_api, passed_context_args, passed_args)

        expect(result).to eq(
          key1: 'instance_args',       # @args (highest)
          key2: 'instance_args',       # @args
          key3: 'instance_context',    # @context_args
          key4: 'p_args',              # passed_args
          key5: 'p_filters'            # passed_filters (lowest)
        )
      end

      it "allows passed params when instance vars are nil" do
        minimal_instance = described_class.new(delegated_obj, nil, nil)

        result = minimal_instance.build_filters(
          passed_filters,
          :test_api,
          passed_context_args,
          passed_args
        )

        expect(result).to eq(
          key1: 'p_filters',
          key3: 'p_context',
          key4: 'p_args',              # passed_args overrides passed_context_args
          key5: 'p_filters'
        )
      end
    end

    context "with delegated_obj_name parameter" do
      it "uses provided API name when specified" do
        result = instance.build_filters({ key: 'value' }, :explicit_api)
        expect(result).to eq(key: 'value')
      end

      it "uses delegated object's name when nil" do
        result = instance.build_filters({ key: 'value' }, nil)
        expect(result).to eq(
          key: 'value',
          key1: 'instance_args',
          key2: 'instance_args',
          key3: 'instance_context'
        )
      end

      it "handles delegated object without name method" do
        nameless = double()
        instance_without_name = described_class.new(nameless)

        result = instance_without_name.build_filters({ key: 'value' }, :fallback_api)
        expect(result).to eq(key: 'value')
      end
    end
  end

  describe ".build_context_args" do
    context "aggregating filters across multiple APIs" do
      let(:passed_args) { {
        api1: { key1: 'args1', key2: 'args1' },
        api3: { key4: 'args3' }
      } }
      let(:passed_context_args) { {
        api1: { key2: 'context1', key3: 'context1' },
        api2: { key5: 'context2' }
      } }

      it "creates filter hash for each API with correct precedence" do
        result = described_class.build_context_args(
          passed_args,
          passed_context_args
        )

        expect(result).to eq(
          api1: { key1: 'args1', key2: 'args1', key3: 'context1' },  # args overrides context
          api2: { key5: 'context2' },
          api3: { key4: 'args3' }
        )
      end

      it "returns nil when no APIs have any data" do
        result = described_class.build_context_args(nil, nil)
        expect(result).to be_nil
      end

      it "returns nil for empty hashes" do
        result = described_class.build_context_args({}, {})
        expect(result).to be_nil
      end
    end

    context "with overlapping API names" do
      it "merges data correctly when APIs appear in both inputs" do
        result = described_class.build_context_args(
          { shared: { key1: 'args', key2: 'args' } },
          { shared: { key2: 'context', key3: 'context' } }
        )

        expect(result).to eq(
          shared: { key1: 'args', key2: 'args', key3: 'context' }
        )
      end
    end
  end

  describe "#build_context_args" do
    let(:instance_args) { { api1: { key1: 'instance_args' } } }
    let(:instance_context_args) { { api2: { key2: 'instance_context' } } }
    let(:instance) { described_class.new(delegated_obj, instance_args, instance_context_args) }

    it "aggregates from instance variables only" do
      result = instance.build_context_args

      expect(result).to eq(
        api1: { key1: 'instance_args' },
        api2: { key2: 'instance_context' }
      )
    end

    it "merges instance vars with passed parameters" do
      result = instance.build_context_args(
        { api1: { key3: 'passed' }, api3: { key5: 'passed' } }
      )

      expect(result).to eq(
        api1: { key1: 'instance_args', key3: 'passed' },  # Both merged
        api2: { key2: 'instance_context' },
        api3: { key5: 'passed' }
      )
    end

    it "returns nil when instance has no data and nothing passed" do
      empty_instance = described_class.new(delegated_obj)
      result = empty_instance.build_context_args

      expect(result).to be_nil
    end
  end

  describe ".build_opts" do
    context "with precedence hierarchy" do
      # Precedence: opts < passed_opts (context-scoped)
      let(:opts) { { key1: 'from_opts', key2: 'from_opts' } }
      let(:passed_opts) { { test_api: { key2: 'from_passed', key3: 'from_passed' } } }

      it "applies correct precedence: opts < passed_opts" do
        result = described_class.build_opts(:test_api, opts, passed_opts)

        expect(result).to eq(
          key1: 'from_opts',           # Only in opts
          key2: 'from_passed',         # passed_opts overrides
          key3: 'from_passed'          # Only in passed_opts
        )
      end
    end

    context "with nil and empty inputs" do
      it "returns nil when all inputs are nil" do
        result = described_class.build_opts(:test_api, nil, nil)
        expect(result).to be_nil
      end

      it "returns nil when all inputs are empty hashes" do
        result = described_class.build_opts(:test_api, {}, {})
        expect(result).to be_nil
      end

      it "handles mix of nil and populated hashes" do
        result = described_class.build_opts(
          :test_api,
          { key: 'value' },
          nil
        )

        expect(result).to eq(key: 'value')
      end
    end

    context "with non-existent API names" do
      it "returns only opts when API not in passed_opts" do
        result = described_class.build_opts(
          :non_existent_api,
          { key: 'value' },
          { test_api: { other: 'data' } }
        )

        expect(result).to eq(key: 'value')
      end
    end
  end

  describe "#build_opts" do
    let(:instance_opts) { { test_api: { key1: 'instance_opts', key2: 'instance_opts' } } }
    let(:instance) { described_class.new(delegated_obj, nil, nil, instance_opts) }

    context "with precedence including instance variable" do
      # Precedence: opts < passed_opts < @opts
      let(:opts) { { key1: 'opts', key3: 'opts' } }
      let(:passed_opts) { { test_api: { key2: 'passed_opts', key3: 'passed_opts', key4: 'passed_opts' } } }

      it "applies full precedence with @opts highest" do
        result = instance.build_opts(opts, :test_api, passed_opts)

        expect(result).to eq(
          key1: 'instance_opts',       # @opts (highest)
          key2: 'instance_opts',       # @opts
          key3: 'passed_opts',         # passed_opts
          key4: 'passed_opts'          # passed_opts
        )
      end

      it "allows passed_opts when @opts is nil" do
        minimal_instance = described_class.new(delegated_obj, nil, nil, nil)

        result = minimal_instance.build_opts(opts, :test_api, passed_opts)

        expect(result).to eq(
          key1: 'opts',
          key2: 'passed_opts',
          key3: 'passed_opts',         # passed_opts overrides opts
          key4: 'passed_opts'
        )
      end
    end

    context "with delegated_obj_name parameter" do
      it "uses provided API name when specified" do
        result = instance.build_opts({ key: 'value' }, :explicit_api)
        expect(result).to eq(key: 'value')
      end

      it "uses delegated object's name when nil" do
        result = instance.build_opts({ key: 'value' }, nil)
        expect(result).to eq(
          key: 'value',
          key1: 'instance_opts',
          key2: 'instance_opts'
        )
      end
    end
  end

  describe ".build_context_opts" do
    context "aggregating opts across multiple APIs" do
      let(:opts) { {
        api1: { key1: 'opts1', key2: 'opts1' },
        api2: { key3: 'opts2' }
      } }
      let(:passed_opts) { {
        api1: { key2: 'passed1' },
        api3: { key4: 'passed3' }
      } }

      it "creates opts hash for each API with correct precedence" do
        result = described_class.build_context_opts(opts, passed_opts)

        expect(result).to eq(
          api1: { key1: 'opts1', key2: 'passed1' },  # passed overrides opts
          api2: { key3: 'opts2' },
          api3: { key4: 'passed3' }
        )
      end

      it "returns nil when no APIs have any data" do
        result = described_class.build_context_opts(nil, nil)
        expect(result).to be_nil
      end

      it "returns nil for empty hashes" do
        result = described_class.build_context_opts({}, {})
        expect(result).to be_nil
      end
    end
  end

  describe "#build_context_opts" do
    let(:instance_opts) { { api1: { key1: 'instance_opts' } } }
    let(:instance) { described_class.new(delegated_obj, nil, nil, instance_opts) }

    it "aggregates from instance variable only" do
      result = instance.build_context_opts

      expect(result).to eq(
        api1: { key1: 'instance_opts' }
      )
    end

    it "merges instance var with passed opts" do
      result = instance.build_context_opts(
        { api1: { key2: 'passed_opts' }, api2: { key3: 'passed_opts' } }
      )

      expect(result).to eq(
        api1: { key1: 'instance_opts', key2: 'passed_opts' },  # Both merged
        api2: { key3: 'passed_opts' }
      )
    end

    it "returns nil when instance has no data and nothing passed" do
      empty_instance = described_class.new(delegated_obj)
      result = empty_instance.build_context_opts

      expect(result).to be_nil
    end
  end

  describe "integration scenarios" do
    it "handles complete workflow with all methods" do
      instance = described_class.new(
        delegated_obj,
        { test_api: { shared: 'args', only_args: 'args' } },
        { test_api: { shared: 'context', only_context: 'context' } },
        { test_api: { shared: 'opts', only_opts: 'opts' } }
      )

      # Test filters
      filters = instance.build_filters({ shared: 'filters' }, :test_api)
      expect(filters[:shared]).to eq('args')  # @args wins
      expect(filters).to include(only_args: 'args', only_context: 'context')

      # Test context args
      context_args = instance.build_context_args
      expect(context_args[:test_api]).to include(
        shared: 'args',
        only_args: 'args',
        only_context: 'context'
      )

      # Test opts
      opts = instance.build_opts({ shared: 'new_opts' }, :test_api)
      expect(opts[:shared]).to eq('opts')  # @opts wins
      expect(opts).to include(only_opts: 'opts')
    end

    it "chains methods to build complex context" do
      org_instance = described_class.new(
        double(name: :organizations),
        { organizations: { id: '123' } }
      )

      context_args = org_instance.build_context_args

      project_instance = described_class.new(
        double(name: :projects),
        { projects: { organization_id: '123' } },
        context_args
      )

      project_filters = project_instance.build_filters({ name: 'test' }, :projects)

      expect(project_filters).to include(
        name: 'test',
        organization_id: '123'
      )
    end
  end
end