# frozen_string_literal: true

require "spec_helper"

RSpec.describe FeedbackConfigSchema do
  it "accepts a valid item with only a label" do
    config = FeedbackConfigSchema.validate!(
      { "aB3kF9mN2q" => { label: "Fix this" } }
    )

    expect(config).to eq(aB3kF9mN2q: { label: "Fix this" })
  end

  it "accepts an item with label and description" do
    config = FeedbackConfigSchema.validate!(
      { "aB3kF9mN2q" => { label: "Fix this", description: "Annotation is misaligned" } }
    )

    expect(config).to eq(
      aB3kF9mN2q: { label: "Fix this", description: "Annotation is misaligned" }
    )
  end

  it "accepts an empty configuration" do
    expect(FeedbackConfigSchema.validate!({})).to eq({})
  end

  it "rejects an item without a label" do
    expect do
      FeedbackConfigSchema.validate!({ "aB3kF9mN2q" => { description: "no label" } })
    end.to raise_error(Verse::Error::ValidationFailed, /Invalid feedback configuration/)
  end

  it "rejects an item with an empty label" do
    expect do
      FeedbackConfigSchema.validate!({ "aB3kF9mN2q" => { label: "" } })
    end.to raise_error(Verse::Error::ValidationFailed, /label can't be empty/)
  end

  it "rejects an item with a whitespace-only label" do
    expect do
      FeedbackConfigSchema.validate!({ "aB3kF9mN2q" => { label: "   " } })
    end.to raise_error(Verse::Error::ValidationFailed, /label can't be empty/)
  end

  it "accepts keys made of letters, digits, underscores and hyphens" do
    config = FeedbackConfigSchema.validate!(
      { "keep_key-2" => { label: "Fine" } }
    )

    expect(config).to eq({ "keep_key-2".to_sym => { label: "Fine" } })
  end

  it "rejects an empty key" do
    expect do
      FeedbackConfigSchema.validate!({ "" => { label: "No key" } })
    end.to raise_error(Verse::Error::ValidationFailed, /Invalid feedback configuration/)
  end

  it "rejects a key that is too long" do
    expect do
      FeedbackConfigSchema.validate!({ "a" * 65 => { label: "Too long" } })
    end.to raise_error(Verse::Error::ValidationFailed, /Invalid feedback configuration/)
  end

  it "rejects a key containing invalid characters" do
    expect do
      FeedbackConfigSchema.validate!({ "a b" => { label: "Space" } })
    end.to raise_error(Verse::Error::ValidationFailed, /Invalid feedback configuration/)
  end

  it "rejects a non-object item" do
    expect do
      FeedbackConfigSchema.validate!({ "aB3kF9mN2q" => "not a hash" })
    end.to raise_error(Verse::Error::ValidationFailed, /must be a hash/)
  end

  it "rejects a non-hash configuration" do
    expect do
      FeedbackConfigSchema.validate!([])
    end.to raise_error(Verse::Error::ValidationFailed, /Invalid feedback configuration/)
  end
end
