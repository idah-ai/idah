
require "spec_helper"

RSpec.describe Context::Base do
  let(:context_api) { double(name: :test_api) }
  let(:args) { { test_api: { key1: 'value1_from_args' } } }
  let(:context_filters) { { test_api: {
    key1: "value1_from_context_filters",
    key2: 'value2_from_context_filters',
    key3: 'value3_from_context_filters' } } }
  let(:passed_filters) { { test_api: {
    key1: 'value1_from_passed_filters',
    key4: 'value4_from_passed_filters',
    key5: 'value5_from_passed_filters' } } }
  let(:passed_context_filters) { { test_api: {
    key2: 'value2_from_passed_context_filters',
    key4: 'value4_from_passed_context_filters' } } }
  let(:passed_args) { { test_api: { key3: 'value3_from_passed_args' } } }

  describe '.build_filters' do
    it 'merges filters with correct precedence' do
      result = described_class.build_filters(
        passed_filters,
        :test_api,
        passed_context_filters,
        passed_args
      )
      expect(result).to eq(
        key1: 'value1_from_passed_filters',     # passed_args overrides passed_filters
        key2: 'value2_from_passed_context_filters',
        key3: 'value3_from_passed_args',     # passed_args overrides passed_context_filters
        key4: 'value4_from_passed_context_filters',
        key5: 'value5_from_passed_filters',  # no override for key5
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

    it 'merges filters with correct precedence' do
      result = instance.build_filters(
        passed_filters,
        :test_api,
        passed_context_filters,
        passed_args
      )
      expect(result).to eq(
        key1: 'value1_from_args',
        key2: 'value2_from_context_filters',
        key3: 'value3_from_passed_args',
        key4: 'value4_from_passed_context_filters',
        key5: 'value5_from_passed_filters'
      )
    end

    it 'uses @context_api.name if context_api_name is nil' do
      allow(context_api).to receive(:name).and_return(:test_api)
      result = instance.build_filters(passed_filters, nil, nil, nil)
      expect(result).to eq(
        key1: 'value1_from_args',            # args overrides passed_filters
        key2: 'value2_from_context_filters', # context_filters overrides passed_filters
        key3: 'value3_from_context_filters', # passed_args overrides context_filters
        key4: 'value4_from_passed_filters',  # no override for key4
        key5: 'value5_from_passed_filters',  # no override for key5
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
end
