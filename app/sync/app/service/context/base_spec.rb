require "spec_helper"

RSpec.describe Context::Base do
  let(:context_api) { double(name: :test_api) }
  let(:args) { { test_api: { key1: 'value1_from_args' } } }
  let(:context_filters) { { test_api: {
    key1: "value1_from_context_filters",
    key2: 'value2_from_context_filters',
    key3: 'value3_from_context_filters' } } }

  # passed_filters is already scoped - no nesting under API name
  let(:passed_filters) { {
    key1: 'value1_from_passed_filters',
    key4: 'value4_from_passed_filters',
    key5: 'value5_from_passed_filters' } }

  # These remain contextualized (nested under API name)
  let(:passed_context_filters) { { test_api: {
    key2: 'value2_from_passed_context_filters',
    key4: 'value4_from_passed_context_filters' } } }
  let(:passed_args) { { test_api: { key3: 'value3_from_passed_args' } } }

  describe 'initialization and instance variables' do
    it 'initializes with all parameters' do
      opts = { test_api: { key: 'value' } }
      instance = described_class.new(context_api, args, context_filters, opts)

      expect(instance.instance_variable_get(:@context_api)).to eq(context_api)
      expect(instance.instance_variable_get(:@args)).to eq(args)
      expect(instance.instance_variable_get(:@context_filters)).to eq(context_filters)
      expect(instance.instance_variable_get(:@opts)).to eq(opts)
    end

    it 'initializes with minimal parameters' do
      instance = described_class.new(context_api)

      expect(instance.instance_variable_get(:@context_api)).to eq(context_api)
      expect(instance.instance_variable_get(:@args)).to be_nil
      expect(instance.instance_variable_get(:@context_filters)).to be_nil
      expect(instance.instance_variable_get(:@opts)).to be_nil
    end
  end

  describe '.build_filters' do
    it 'merges filters with correct precedence' do
      result = described_class.build_filters(
        passed_filters,
        :test_api,
        passed_context_filters,
        passed_args
      )

      expect(result).to eq(
        key1: 'value1_from_passed_filters',     # from passed_filters (lowest precedence)
        key2: 'value2_from_passed_context_filters', # context_filters override filters
        key3: 'value3_from_passed_args',        # args override context_filters (highest)
        key4: 'value4_from_passed_context_filters', # context_filters override filters
        key5: 'value5_from_passed_filters',     # no override for key5
      )
    end

    it 'handles nil inputs' do
      result = described_class.build_filters(nil, :test_api, nil, nil)
      expect(result).to eq(nil)
    end
  end

  describe '#build_filters' do
    let(:instance) do
      described_class.new(
        context_api,
        args,
        context_filters
      )
    end

    it 'merges filters with correct precedence (instance vars take precedence)' do
      result = instance.build_filters(
        passed_filters,
        :test_api,
        passed_context_filters,
        passed_args
      )

      expect(result).to eq(
        key1: 'value1_from_args',               # @args (highest precedence)
        key2: 'value2_from_context_filters',    # @context_filters override passed
        key3: 'value3_from_passed_args',        # passed_args override @context_filters
        key4: 'value4_from_passed_context_filters', # from passed_context_filters
        key5: 'value5_from_passed_filters'      # from passed_filters (lowest)
      )
    end

    it 'uses @context_api.name if context_api_name is nil' do
      allow(context_api).to receive(:name).and_return(:test_api)
      result = instance.build_filters(passed_filters, nil, nil, nil)

      expect(result).to eq(
        key1: 'value1_from_args',               # @args override passed_filters
        key2: 'value2_from_context_filters',    # @context_filters override passed_filters
        key3: 'value3_from_context_filters',    # from @context_filters
        key4: 'value4_from_passed_filters',     # from passed_filters (no override)
        key5: 'value5_from_passed_filters',     # from passed_filters (no override)
      )
    end
  end

  describe '.build_context_filters_from' do
    let(:all_args) { { test_api: { key1: 'value1_from_all_args' } } }
    let(:all_context_filters) { { test_api: { key2: 'value2_from_all_context_filters' } } }

    it 'aggregates filters for all APIs' do
      result = described_class.build_context_filters_from(
        all_context_filters,
        all_args
      )

      expect(result).to eq(
        test_api: {
          key1: 'value1_from_all_args',
          key2: 'value2_from_all_context_filters'
        }
      )
    end
  end

  describe '#build_context_filters_from' do
    let(:instance) do
      described_class.new(
        context_api,
        args,
        context_filters
      )
    end

    it 'aggregates filters for all APIs' do
      result = instance.build_context_filters_from

      expect(result).to eq(
        test_api: {
          key1: 'value1_from_args',
          key2: 'value2_from_context_filters',
          key3: 'value3_from_context_filters'
        }
      )
    end
  end

    # Add these specs to your Context::Base spec file

  describe '.build_opts' do
    # opts is already scoped - no nesting under API name
    let(:opts) { {
      key1: 'value1_from_opts',
      key2: 'value2_from_opts'
    } }

    # passed_opts remains contextualized (nested under API name)
    let(:passed_opts) { { test_api: {
      key1: 'value1_from_passed_opts',
      key3: 'value3_from_passed_opts'
    } } }

    it 'merges opts with correct precedence' do
      result = described_class.build_opts(
        opts,
        :test_api,
        passed_opts
      )

      expect(result).to eq(
        key1: 'value1_from_passed_opts',  # passed_opts override opts
        key2: 'value2_from_opts',          # from opts (no override)
        key3: 'value3_from_passed_opts'    # from passed_opts
      )
    end

    it 'handles nil inputs' do
      result = described_class.build_opts(nil, :test_api, nil)
      expect(result).to eq(nil)
    end

    it 'returns nil for empty merged hash' do
      result = described_class.build_opts({}, :test_api, {})
      expect(result).to eq(nil)
    end
  end

  describe '#build_opts' do
    let(:opts_instance_var) { { test_api: {
      key1: 'value1_from_instance',
      key2: 'value2_from_instance'
    } } }

    let(:opts) { {
      key2: 'value2_from_opts',
      key3: 'value3_from_opts'
    } }

    let(:passed_opts) { { test_api: {
      key1: 'value1_from_passed_opts',
      key3: 'value3_from_passed_opts',
      key4: 'value4_from_passed_opts'
    } } }

    let(:instance) do
      described_class.new(
        context_api,
        args,
        context_filters,
        opts_instance_var
      )
    end

    it 'merges opts with correct precedence (instance @opts take precedence)' do
      result = instance.build_opts(
        opts,
        :test_api,
        passed_opts
      )

      expect(result).to eq(
        key1: 'value1_from_instance',      # @opts (highest precedence)
        key2: 'value2_from_instance',      # @opts override passed_opts
        key3: 'value3_from_passed_opts',   # passed_opts override opts
        key4: 'value4_from_passed_opts'    # from passed_opts
      )
    end

    it 'uses @context_api.name if context_api_name is nil' do
      allow(context_api).to receive(:name).and_return(:test_api)
      result = instance.build_opts(opts, nil, nil)

      expect(result).to eq(
        key1: 'value1_from_instance',  # @opts override opts
        key2: 'value2_from_instance',  # @opts override opts
        key3: 'value3_from_opts'       # from opts (no override)
      )
    end

    it 'handles nil passed_opts' do
      result = instance.build_opts(opts, :test_api, nil)

      expect(result).to eq(
        key1: 'value1_from_instance',
        key2: 'value2_from_instance',
        key3: 'value3_from_opts'
      )
    end
  end

  describe '#merge_with_instance_var (private)' do
    let(:instance) do
      described_class.new(
        context_api,
        args,
        context_filters
      )
    end

    let(:instance_var) { {
      test_api: { key1: 'value1_instance', key2: 'value2_instance' },
      other_api: { key3: 'value3_instance' }
    } }

    let(:passed_hash) { {
      test_api: { key1: 'value1_passed', key4: 'value4_passed' },
      other_api: { key5: 'value5_passed' }
    } }

    it 'merges instance var with passed hash for specific API' do
      result = instance.send(
        :merge_with_instance_var,
        :test_api,
        instance_var,
        passed_hash
      )

      expect(result).to eq(
        test_api: {
          key1: 'value1_instance',  # instance_var takes precedence
          key2: 'value2_instance',  # from instance_var
          key4: 'value4_passed'     # from passed_hash
        }
      )
    end

    it 'returns nil when api_name is nil' do
      result = instance.send(
        :merge_with_instance_var,
        nil,
        instance_var,
        passed_hash
      )

      expect(result).to be_nil
    end

    it 'handles nil instance_var' do
      result = instance.send(
        :merge_with_instance_var,
        :test_api,
        nil,
        passed_hash
      )

      expect(result).to eq(
        test_api: {
          key1: 'value1_passed',
          key4: 'value4_passed'
        }
      )
    end

    it 'handles nil passed_hash' do
      result = instance.send(
        :merge_with_instance_var,
        :test_api,
        instance_var,
        nil
      )

      expect(result).to eq(
        test_api: {
          key1: 'value1_instance',
          key2: 'value2_instance'
        }
      )
    end

    it 'returns nil for empty merged result' do
      result = instance.send(
        :merge_with_instance_var,
        :non_existent_api,
        instance_var,
        passed_hash
      )

      expect(result).to be_nil
    end

    it 'handles API that exists in passed_hash but not instance_var' do
      result = instance.send(
        :merge_with_instance_var,
        :other_api,
        nil,
        passed_hash
      )

      expect(result).to eq(
        other_api: {
          key5: 'value5_passed'
        }
      )
    end
  end

    describe '.build_filters edge cases' do
    it 'handles multiple API contexts' do
      multi_context = {
        api1: { key1: 'value1' },
        api2: { key2: 'value2' }
      }
      multi_args = {
        api1: { key1: 'override1' },
        api2: { key2: 'override2' }
      }

      result = described_class.build_filters(
        { key3: 'value3' },
        :api1,
        multi_context,
        multi_args
      )

      expect(result).to eq(
        key1: 'override1',  # args override context
        key3: 'value3'       # from filters
      )
    end

    it 'handles non-string values' do
      result = described_class.build_filters(
        { int_key: 123, bool_key: true, nil_key: nil },
        :test_api,
        { test_api: { array_key: [1, 2, 3] } },
        { test_api: { hash_key: { nested: 'value' } } }
      )

      expect(result).to eq(
        int_key: 123,
        bool_key: true,
        nil_key: nil,
        array_key: [1, 2, 3],
        hash_key: { nested: 'value' }
      )
    end

    it 'returns nil when all inputs are empty hashes' do
      result = described_class.build_filters({}, :test_api, {}, {})
      expect(result).to be_nil
    end

    it 'handles API name that does not exist in any hash' do
      result = described_class.build_filters(
        { key: 'value' },
        :non_existent_api,
        { test_api: { key2: 'value2' } },
        { test_api: { key3: 'value3' } }
      )

      expect(result).to eq(key: 'value')
    end
  end

  describe '#build_filters edge cases' do
    let(:instance) do
      described_class.new(
        context_api,
        { test_api: { key1: 'instance_args' } },
        { test_api: { key2: 'instance_context' } },
        { test_api: { key3: 'instance_opts' } }
      )
    end

    it 'handles context_api without name method' do
      api_without_name = double()
      instance_no_name = described_class.new(api_without_name)

      result = instance_no_name.build_filters(
        { key: 'value' },
        :explicit_api,
        nil,
        nil
      )

      expect(result).to eq(key: 'value')
    end

    it 'merges all four sources correctly' do
      result = instance.build_filters(
        { key1: 'passed_filters', key2: 'passed_filters', key3: 'passed_filters', key4: 'passed_filters' },
        :test_api,
        { test_api: { key2: 'passed_context', key3: 'passed_context' } },
        { test_api: { key3: 'passed_args' } }
      )

      # Precedence: passed_filters < passed_context_filters < @context_filters < passed_args < @args
      expect(result).to eq(
        key1: 'instance_args',     # @args highest
        key2: 'instance_context',  # @context_filters override passed_context
        key3: 'passed_args',       # passed_args override @context_filters
        key4: 'passed_filters'     # lowest precedence
      )
    end
  end

  describe '.build_context_filters_from edge cases' do
    it 'handles multiple APIs with different keys' do
      result = described_class.build_context_filters_from(
        {
          api1: { key1: 'value1', key2: 'value2' },
          api2: { key3: 'value3' },
          api3: { key4: 'value4' }
        },
        {
          api1: { key2: 'override2' },
          api2: { key5: 'value5' },
          api4: { key6: 'value6' }
        }
      )

      expect(result).to eq(
        api1: { key1: 'value1', key2: 'override2' },
        api2: { key3: 'value3', key5: 'value5' },
        api3: { key4: 'value4' },
        api4: { key6: 'value6' }
      )
    end

    it 'returns empty hash when both inputs are nil' do
      result = described_class.build_context_filters_from(nil, nil)
      expect(result).to eq({})
    end

    it 'returns empty hash when both inputs are empty hashes' do
      result = described_class.build_context_filters_from({}, {})
      expect(result).to eq({})
    end
  end

  describe '#build_context_filters_from edge cases' do
    let(:instance) do
      described_class.new(
        context_api,
        { api1: { key1: 'instance_args' } },
        { api2: { key2: 'instance_context' } }
      )
    end

    it 'combines instance vars with passed params across multiple APIs' do
      result = instance.build_context_filters_from(
        { api1: { key1: 'passed_context' }, api3: { key3: 'passed_context' } },
        { api2: { key2: 'passed_args' }, api4: { key4: 'passed_args' } }
      )

      expect(result).to eq(
        api1: { key1: 'instance_args' },     # instance @args take precedence
        api2: { key2: 'passed_args' },       # passed_args override @context_filters
        api3: { key3: 'passed_context' },
        api4: { key4: 'passed_args' }
      )
    end

    it 'returns empty hash when no data in instance vars or params' do
      empty_instance = described_class.new(context_api)
      result = empty_instance.build_context_filters_from(nil, nil)

      expect(result).to eq({})
    end
  end

  describe '#merge_with_instance_var comprehensive coverage' do
    let(:instance) { described_class.new(context_api) }

    it 'handles deeply nested values' do
      instance_var = {
        test_api: {
          nested: {
            deep: {
              value: 'instance'
            }
          }
        }
      }
      passed_hash = {
        test_api: {
          nested: {
            deep: {
              value: 'passed',
              other: 'data'
            }
          }
        }
      }

      result = instance.send(
        :merge_with_instance_var,
        :test_api,
        instance_var,
        passed_hash
      )

      # Note: Hash#merge does shallow merge
      expect(result).to eq(
        test_api: {
          nested: { deep: { value: 'instance' } }  # instance takes precedence
        }
      )
    end

    it 'preserves empty hash values' do
      result = instance.send(
        :merge_with_instance_var,
        :test_api,
        { test_api: {} },
        { test_api: {} }
      )

      expect(result).to be_nil  # Empty hash returns nil
    end

    it 'handles symbol vs string keys differently' do
      result = instance.send(
        :merge_with_instance_var,
        :test_api,
        { test_api: { key: 'symbol_key', 'key' => 'string_key' } },
        { test_api: { other: 'value' } }
      )

      expect(result).to eq(
        test_api: {
          key: 'symbol_key',
          'key' => 'string_key',
          other: 'value'
        }
      )
    end
  end

  describe 'integration scenarios' do
    it 'handles complete workflow with all methods' do
      instance = described_class.new(
        context_api,
        { test_api: { shared_key: 'from_args' } },
        { test_api: { shared_key: 'from_context' } }
      )

      filters = instance.build_filters(
        { shared_key: 'from_filters' },
        :test_api,
        nil,
        nil
      )

      expect(filters).to eq(shared_key: 'from_args')

      context_filters = instance.build_context_filters_from(
        { test_api: { new_key: 'new_value' } },
        nil
      )

      expect(context_filters[:test_api]).to include(
        shared_key: 'from_args',
        new_key: 'new_value'
      )
    end
  end
end
