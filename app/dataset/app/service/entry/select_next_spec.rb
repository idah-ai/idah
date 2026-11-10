# frozen_string_literal: true

require "spec_helper"
require "timeout"

# Committed fixtures and separate connections are required to exercise SKIP LOCKED.
RSpec.describe "Concurrent Entry claims", database: false do
  let(:system_context) { Verse::Auth::Context[:system] }
  let(:projects) { Project::Repository.new(system_context) }
  let(:datasets) { Dataset::Repository.new(system_context) }
  let(:entries) { Entry::Repository.new(system_context) }

  [1, 2].each do |count|
    it "does not double-claim with #{count} available entries" do
      project_id = projects.create(name: "Claim test", organization_id: 1, created_by_email: "test@example.com")
      dataset_id = datasets.create(
        project_id: project_id,
        modality: "video",
        labeling_configuration: {},
        workflow_configuration: {}
      )
      contexts = [:reviewer, :project_owner].map do |name|
        user = Verse::Spec[name]
        context = Verse::Auth::Context.from_role(user[:role], metadata: user[:user_data], custom_scopes: user[:scopes])
        ProjectMember::Repository.new(system_context).create(
          project_id: project_id,
          account_id: context.metadata[:id],
          email: context.metadata[:email],
          role: "reviewer",
          invited_by_id: 1
        )
        context
      end
      ids = count.times.map do
        entries.no_event do
          entries.create(
            project_id: project_id,
            dataset_id: dataset_id,
            resource: UUIDv7.generate,
            status: "pending",
            wf_step: "review",
            submitted_by_id: 4,
            assigned_to_id: nil,
            priority: 0
          )
        end
      end
      first = Entry::Service.new(contexts[0])
      second = Entry::Service.new(contexts[1])
      locked = Queue.new
      release = Queue.new
      allow(first.entries).to receive(:lock_next_id).and_wrap_original do |method, **args|
        id = method.call(**args)
        locked << id
        release.pop
        id
      end
      worker = Thread.new { first.select_next(dataset_id: dataset_id, wf_step: "review") }
      worker.report_on_exception = false
      locked_id = Timeout.timeout(5) { locked.pop }
      expect(ids).to include(locked_id)
      other = Timeout.timeout(5) { second.select_next(dataset_id: dataset_id, wf_step: "review") }
      if count == 1
        expect(other).to be_nil
      else
        expect(ids - [locked_id]).to include(other.id)
        expect(entries.find!(other.id).assigned_to_id).to eq(contexts[1].metadata[:id])
      end
      release << true
      result = Timeout.timeout(5) { worker.value }
      expect(result.id).to eq(locked_id)
      expect(entries.find!(locked_id).assigned_to_id).to eq(contexts[0].metadata[:id])
      # Once committed, another reviewer cannot select this assignee's work.
      if count == 1
        expect { second.select_next(dataset_id: dataset_id, wf_step: "review") }.to raise_error(Verse::Error::RecordNotFound)
      else
        expect(second.select_next(dataset_id: dataset_id, wf_step: "review")&.id).not_to eq(locked_id)
      end
    ensure
      release << true if release
      worker&.join(5)
      worker&.kill if worker&.alive?
      projects.delete(project_id) if project_id
    end
  end

  it "rolls back assignment and progress if service select fails before commit", as: :admin do
    project_id = projects.create(name: "Claim rollback test", organization_id: 1, created_by_email: "test@example.com")
    dataset_id = datasets.create(
      project_id: project_id,
      modality: "video",
      labeling_configuration: {},
      workflow_configuration: {}
    )
    id = entries.no_event do
      entries.create(
        project_id: project_id,
        dataset_id: dataset_id,
        resource: UUIDv7.generate,
        status: "pending",
        wf_step: "start",
        assigned_to_id: nil,
        priority: 0
      )
    end
    service = Entry::Service.new(current_auth_context)
    allow(service).to receive(:select).and_wrap_original do |method, entry_id|
      method.call(entry_id)
      raise "selection failed"
    end
    expect { service.select_next(dataset_id: dataset_id, wf_step: "start") }.to raise_error("selection failed")
    expect(entries.find!(id).assigned_to_id).to be_nil
    expect(entries.find!(id).status).to eq("pending")
    expect(datasets.find!(dataset_id).status).to eq("pending")
  ensure
    projects.delete(project_id) if project_id
  end
end
