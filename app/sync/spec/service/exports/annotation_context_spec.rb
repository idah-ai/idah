# frozen_string_literal: true

require "spec_helper"
require_relative "../../../app/service/exports/annotation_context"

RSpec.describe Exports::AnnotationContext do
  let(:annotation_id) { "019b2aec-94ff-7b50-bb44-8a3675e266f3" }
  let(:annotation) do
    double(
      "Annotation",
      id: annotation_id,
      dimensions: {
        type: "idah-video:bounding-box",
        end: 119,
        range: [1, 1],
        start: 1,
        frames: []
      },
      annotation: {
        category: "vehicles/car"
      },
      data: {
        attributes: {
          created_by_email: "admin@idah.ai",
          created_at: "2025-12-17 06:08:26 +0000",
          updated_at: "2025-12-17 06:11:26 +0000",
          metadata: {
            custom_field: "value"
          }
        }
      }
    )
  end

  subject { described_class.new(annotation) }

  describe "#annotation" do
    it "returns the annotation object" do
      expect(subject.annotation).to eq(annotation)
    end

    it "provides access to annotation id" do
      expect(subject.annotation.id).to eq(annotation_id)
    end

    it "provides access to annotation dimensions" do
      expect(subject.annotation.dimensions).to be_a(Hash)
      expect(subject.annotation.dimensions[:type]).to eq("idah-video:bounding-box")
      expect(subject.annotation.dimensions[:end]).to eq(119)
      expect(subject.annotation.dimensions[:start]).to eq(1)
    end

    it "provides access to annotation data" do
      expect(subject.annotation.annotation).to be_a(Hash)
      expect(subject.annotation.annotation[:category]).to eq("vehicles/car")
    end

    it "provides access to annotation attributes" do
      expect(subject.annotation.data[:attributes]).to be_a(Hash)
      expect(subject.annotation.data[:attributes][:created_by_email]).to eq("admin@idah.ai")
    end
  end
end
