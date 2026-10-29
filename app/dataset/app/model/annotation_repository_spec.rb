# frozen_string_literal: true

require "spec_helper"

# Repository-level write behavior: write_shape/write_shapes own the SQL and the
# locks; service-level guards are covered by service_spec.rb.
RSpec.describe Annotation::Repository, database: true do
  let(:admin) { Verse::Spec.users.fetch(:admin) }
  let(:auth_context) do
    Verse::Auth::Context.from_role(
      admin[:role],
      custom_scopes: admin[:scopes],
      metadata: admin[:user_data]
    )
  end

  subject { described_class.new(auth_context) }

  let(:system_context) { Verse::Auth::Context[:system] }
  let(:project_repo) { Project::Repository.new(system_context) }
  let(:dataset_repo) { Dataset::Repository.new(system_context) }
  let(:entry_repo) { Entry::Repository.new(system_context) }

  let!(:project_id) do
    project_repo.create(
      name: "Test Project",
      description: "A test project",
      created_by_email: "user@example.com",
      organization_id: 1,
    )
  end

  let!(:dataset_id) do
    dataset_repo.create(
      modality: "image_labeling",
      labels: ["cat", "dog"],
      labeling_configuration: { "width" => 100, "height" => 100 },
      workflow_configuration: {},
      project_id:
    )
  end

  let!(:entry_id) do
    entry_repo.create(
      priority: 1,
      wf_step: "start",
      status: "pending",
      assigned_to_id: 1,
      project_id:,
      dataset_id:
    )
  end

  let!(:annotation_id) do
    subject.create(
      project_id:,
      dataset_id:,
      entry_id:,
      shape_type: "mask",
      shape_args: { x: 10, y: 20, width: 30, height: 40 },
      category: "cat",
      properties: { label: "cat" },
      created_by_email: "user@example.com"
    )
  end

  describe "#write_shape" do
    it "upserts a Hash value" do
      subject.write_shape(annotation_id, "tile-0x0", { rle: "ABC" })

      rows = subject.client { |db| db[:annotation_shape].where(annotation_id:).all }
      expect(rows.size).to eq(1)
      expect(rows.first[:key]).to eq("tile-0x0")
      expect(rows.first[:value]).to eq({ "rle" => "ABC" })
    end

    it "deletes with a nil value and is idempotent for missing keys" do
      subject.write_shape(annotation_id, "tile-0x0", { rle: "ABC" })
      subject.write_shape(annotation_id, "tile-0x0", nil)

      rows = subject.client { |db| db[:annotation_shape].where(annotation_id:).all }
      expect(rows).to be_empty

      expect { subject.write_shape(annotation_id, "tile-0x0", nil) }.not_to raise_error
    end

    it "rejects a missing key" do
      expect { subject.write_shape(annotation_id, nil, { rle: "A" }) }
        .to raise_error(Verse::Error::ValidationFailed, /key is required/)
      expect { subject.write_shape(annotation_id, "", { rle: "A" }) }
        .to raise_error(Verse::Error::ValidationFailed, /key is required/)
    end

    it "rejects a value that is neither nil nor a Hash" do
      expect { subject.write_shape(annotation_id, "tile-0x0", "not-a-hash") }
        .to raise_error(Verse::Error::ValidationFailed, /value must be null/)
    end

    it "touches updated_at on the parent annotation" do
      before = subject.client { |db| db[:annotations].where(id: annotation_id).get(:updated_at) }

      subject.write_shape(annotation_id, "tile-0x0", { rle: "ABC" })

      after = subject.client { |db| db[:annotations].where(id: annotation_id).get(:updated_at) }
      expect(after).to be > before
    end

    it "publishes no event" do
      expect(Verse).not_to receive(:publish_resource_event)
      subject.write_shape(annotation_id, "tile-0x0", { rle: "ABC" })
    end
  end

  describe "#write_shapes" do
    it "writes several rows in one call" do
      subject.write_shapes(
        annotation_id,
        [
          { key: "tile-0x0", value: { rle: "A" } },
          { key: "tile-0x1", value: { rle: "B" } }
        ]
      )

      rows = subject.client { |db| db[:annotation_shape].where(annotation_id:).all }
      expect(rows.size).to eq(2)
    end

    it "repeating the same write changes nothing on the parent" do
      subject.write_shapes(annotation_id, [{ key: "tile-0x0", value: { rle: "A" } }])
      before = subject.client { |db| db[:annotations].where(id: annotation_id).get(:updated_at) }
      sleep 0.01

      subject.write_shapes(annotation_id, [{ key: "tile-0x0", value: { rle: "A" } }])

      after = subject.client { |db| db[:annotations].where(id: annotation_id).get(:updated_at) }
      expect(after).to eq(before)
    end

    it "raises not-found for an unknown annotation" do
      expect { subject.write_shapes(UUIDv7.generate, [{ key: "tile-0x0", value: { rle: "A" } }]) }
        .to raise_error(Verse::Error::RecordNotFound)
    end
  end
end
