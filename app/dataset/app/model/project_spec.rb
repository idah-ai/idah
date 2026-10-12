# frozen_string_literal: true

require "spec_helper"

RSpec.describe Project, database: true do
  describe Project::Repository do
    subject{ described_class.new(Verse::Auth::Context.new) }

    it "can be instantiated" do
      expect(subject).to be_a(Project::Repository)
    end

    describe "event metadata for cache invalidation" do
      let(:system_auth_context) { Verse::Auth::Context[:system] }
      let(:project_repo) { described_class.new(system_auth_context) }
      let(:captured) { [] }

      before do
        allow(Verse).to receive(:publish_resource_event) do |**opts|
          captured << opts[:payload][:metadata]
        end
      end

      it "create emits organization_id" do
        id = project_repo.create(
          name: "Meta Project",
          organization_id: 5,
          created_by_email: "admin@example.com"
        )

        expect(captured.last).to include(organization_id: 5)
      end

      it "update! emits organization_id and project_id" do
        id = project_repo.create(
          name: "Meta Project",
          organization_id: 5,
          created_by_email: "admin@example.com"
        )
        captured.clear

        project_repo.update!(id, { name: "Renamed" })

        expect(captured.last).to include(
          organization_id: 5,
          project_id: id
        )
        expect(captured.last).not_to have_key(:previous_organization_id)
      end

      it "update! emits previous_organization_id when the organization changes" do
        id = project_repo.create(
          name: "Meta Project",
          organization_id: 5,
          created_by_email: "admin@example.com"
        )
        captured.clear

        project_repo.update!(id, { organization_id: 6 })

        expect(captured.last).to include(
          organization_id: 6,
          project_id: id,
          previous_organization_id: 5
        )
      end

      it "delete! emits organization_id and project_id" do
        id = project_repo.create(
          name: "Meta Project",
          organization_id: 5,
          created_by_email: "admin@example.com"
        )
        captured.clear

        project_repo.delete!(id)

        expect(captured.last).to include(
          organization_id: 5,
          project_id: id
        )
      end
    end
  end
end
