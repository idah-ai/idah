# frozen_string_literal: true

require_relative "../spec_helper"

RSpec.describe Exports::Repository, database: true do
  let(:auth_context) { Verse::Auth::Context[:system] }

  subject(:repo) { described_class.new(auth_context) }

  let(:jobs_service) { Jobs::Service.new(auth_context) }

  def create_export(job_arguments)
    job = jobs_service.create("Exports::Job", arguments: job_arguments)
    repo.create({ job_id: job.id, project_id: "019c9428-50d4-7b1b-a8bb-68cd3a284cef", created_by_id: 1 })
  end

  describe "dataset_id__eq filter" do
    it "returns only entry exports for the given dataset" do
      entry_export = create_export({ dataset_ids: ["ds1"], entry_ids: %w[e1 e2] })
      create_export({ dataset_ids: ["ds1"] }) # dataset export — excluded
      create_export({ dataset_ids: ["ds2"], entry_ids: ["e3"] }) # different dataset

      exports = repo.index({ dataset_id__eq: "ds1" })

      expect(exports.size).to eq(1)
      expect(exports.first.id.to_s).to eq(entry_export.to_s)
    end

    it "returns nothing when only dataset exports exist for the dataset" do
      create_export({ dataset_ids: ["ds1"] })

      expect(repo.index({ dataset_id__eq: "ds1" })).to be_empty
    end

    it "returns nothing when there are no exports for the dataset" do
      create_export({ dataset_ids: ["ds1"], entry_ids: ["e1"] })

      expect(repo.index({ dataset_id__eq: "other" })).to be_empty
    end
  end
end
