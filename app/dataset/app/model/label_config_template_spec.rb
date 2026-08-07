# frozen_string_literal: true

require "spec_helper"

RSpec.describe LabelConfigTemplate, database: true do
  describe LabelConfigTemplate::Repository do
    subject { described_class.new(Verse::Auth::Context.new) }

    it "can be instantiated" do
      expect(subject).to be_a(LabelConfigTemplate::Repository)
    end

    # Use system context to create test data without scoping restrictions
    let(:system_auth_context) { Verse::Auth::Context[:system] }
    let(:project_repo) { Project::Repository.new(system_auth_context) }
    let(:project_member_repo) { ProjectMember::Repository.new(system_auth_context) }
    let(:template_repo) { described_class.new(system_auth_context) }

    let!(:project_org1) do
      project_repo.create(
        name: "Project Org 1",
        description: "Test project in organization 1",
        organization_id: 1,
        created_by_email: "admin@example.com"
      )
    end

    let!(:project_org2) do
      project_repo.create(
        name: "Project Org 2",
        description: "Test project in organization 2",
        organization_id: 2,
        created_by_email: "admin@example.com"
      )
    end

    # Account 3 is a project_owner in organization 1 only
    let!(:pm_project_owner_org1) do
      project_member_repo.create(
        project_id: project_org1,
        account_id: 3,
        name: "Project Owner User",
        email: "project_owner@example.com",
        role: "project_owner",
        invited_by_id: 1
      )
    end

    # Account 4 is an annotator in organization 1 (not a project_owner)
    let!(:pm_annotator_org1) do
      project_member_repo.create(
        project_id: project_org1,
        account_id: 4,
        name: "Annotator User",
        email: "annotator@example.com",
        role: "annotator",
        invited_by_id: 1
      )
    end

    let!(:template_org1) do
      template_repo.create(
        organization_id: 1,
        name: "Org 1 Template",
        labeling_configuration: { "tools" => ["bbox"] },
        modality: "idah-video",
        created_by_id: 1,
        updated_by_id: 1
      )
    end

    let!(:template_org2) do
      template_repo.create(
        organization_id: 2,
        name: "Org 2 Template",
        labeling_configuration: { "tools" => ["polygon"] },
        modality: "idah-video",
        created_by_id: 1,
        updated_by_id: 1
      )
    end

    describe "#scoped" do
      context "As Admin", as: :admin do
        subject { described_class.new(current_auth_context) }

        it "returns all templates for :read action" do
          result = subject.scoped(:read).all

          expect(result.size).to eq(2)
          expect(result.map { |r| r[:name] }).to match_array(["Org 1 Template", "Org 2 Template"])
        end

        %i[create update delete].each do |action|
          it "returns all templates for :#{action} action" do
            expect(subject.scoped(action).all.size).to eq(2)
          end
        end
      end

      context "As Org Owner", as: :org_owner do
        subject { described_class.new(current_auth_context) }

        # org_owner has scopes: { org: ["1"] }
        it "returns templates scoped to the owned organization" do
          result = subject.scoped(:read).all

          expect(result.size).to eq(1)
          expect(result.first[:name]).to eq("Org 1 Template")
        end

        context "with no org scopes" do
          before do
            allow(current_auth_context).to receive(:custom_scopes).and_return({})
          end

          it "returns no results" do
            expect(subject.scoped(:read).all.size).to eq(0)
          end
        end
      end

      context "As project_owner user", as: :project_owner do
        subject { described_class.new(current_auth_context) }

        # account 3 is a project_owner in organization 1
        it "returns templates from organizations they own a project in" do
          result = subject.scoped(:read).all

          expect(result.size).to eq(1)
          expect(result.first[:name]).to eq("Org 1 Template")
        end
      end

      context "As non-owner user", as: :annotator do
        subject { described_class.new(current_auth_context) }

        # account 4 is an annotator, not a project_owner, so sees nothing
        it "returns no templates" do
          expect(subject.scoped(:read).all.size).to eq(0)
        end
      end
    end

    describe "filters" do
      subject { described_class.new(system_auth_context) }

      it "filters by organization_id" do
        result = subject.index({ organization_id: 1 })

        expect(result.size).to eq(1)
        expect(result.first.name).to eq("Org 1 Template")
      end

      it "filters by organization_id__in" do
        result = subject.index({ organization_id__in: [1, 2] })

        expect(result.size).to eq(2)
      end

      it "filters by name__match" do
        result = subject.index({ name__match: "Org 1" })

        expect(result.size).to eq(1)
        expect(result.first.name).to eq("Org 1 Template")
      end
    end
  end
end
