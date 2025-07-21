# frozen_string_literal: true

require "spec_helper"

RSpec.describe Project::Service, database: true do
  let(:auth_context){ Verse::Auth::Context.new }

  subject { described_class.new(auth_context) }

  let(:repo) { Project::Repository.new(auth_context) }

  let(:update_data) do
    {
      data: {
        type: "projects",
        id: "1",
        attributes: {
          name: "Test Project",
          description: "A test project",
        }
      }
    }
  end

  describe "#create" do
    it "creates a new project" do
      project = subject.create(name: "Test Project", description: "A test project")
      expect(project.name).to eq("Test Project")
      expect(project.description).to eq("A test project")
      expect(project.created_by_id).to eq(nil)
    end
  end

  describe "#show" do
    it "shows a project" do
      project_id = repo.create(name: "Test Project", description: "A test project", created_by_id: 1)
      found_project = subject.show(project_id)
      expect(found_project.id).to eq(project_id.to_i)
    end
  end

  describe "#update" do
    it "updates a project" do
      project_id = repo.create(name: "Test Project", description: "A test project", created_by_id: 1)

      update_data[:data][:id] = project_id
      update_data[:data][:attributes][:name] = "Updated Project"

      record = deserialize(update_data)
      subject.update(record)

      updated_project = repo.find!(project_id)
      expect(updated_project.name).to eq("Updated Project")
    end
  end

  describe "#delete" do
    it "deletes a project" do
      project_id = repo.create(name: "Test Project", description: "A test project", created_by_id: 1)
      subject.delete(project_id)
      expect { repo.find!(project_id) }.to raise_error(Verse::Error::NotFound)
    end
  end
end
