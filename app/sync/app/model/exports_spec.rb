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
end
