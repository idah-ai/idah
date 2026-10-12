# frozen_string_literal: true

module Webhook
  module Handlers
    module Dataset
      Handlers.define "dataset.project.created",
                      event: "dataset:projects:created",
                      label: "Project Created",
                      desc: "Triggered when a project is created",
                      allowed_roles: %w[admin org_owner],
                      payload: ->(m) { { project: Handlers.fetch(:projects, Handlers.resource_id(m)) } }

      Handlers.define "dataset.project.updated",
                      event: "dataset:projects:updated",
                      label: "Project Updated",
                      desc: "Triggered when a project is updated",
                      allowed_roles: %w[admin org_owner user],
                      payload: ->(m) { { project: Handlers.fetch(:projects, Handlers.resource_id(m)) } }

      Handlers.define "dataset.project.deleted",
                      event: "dataset:projects:deleted",
                      label: "Project Deleted",
                      desc: "Triggered when a project is deleted",
                      allowed_roles: %w[admin org_owner],
                      payload: ->(m) {
                        {
                          project: {
                            id: Handlers.resource_id(m),
                            organization_id: Handlers.metadata(m)[:organization_id]
                          }
                        }
                      }

      Handlers.define "dataset.project.member.added",
                      event: "dataset:project_members:created",
                      label: "Project Member Added",
                      desc: "Triggered when a member is added to a project",
                      allowed_roles: %w[admin org_owner user],
                      payload: ->(m) { { project_member: Handlers.fetch(:project_members, Handlers.resource_id(m)) } }

      Handlers.define "dataset.project.member.role_updated",
                      event: "dataset:project_members:updated",
                      label: "Project Member Role Updated",
                      desc: "Triggered when a project member's role is changed",
                      allowed_roles: %w[admin org_owner user],
                      match: ->(m) { Handlers.changes(m).key?(:role) },
                      payload: ->(m) { { project_member: Handlers.fetch(:project_members, Handlers.resource_id(m)) } }

      Handlers.define "dataset.project.member.removed",
                      event: "dataset:project_members:updated",
                      label: "Project Member Removed",
                      desc: "Triggered when a member is removed from a project",
                      allowed_roles: %w[admin org_owner user],
                      match: ->(m) { Handlers.changes(m)[:disabled_at] },
                      payload: ->(m) { { project_member: Handlers.fetch(:project_members, Handlers.resource_id(m)) } }

      Handlers.define "dataset.dataset.created",
                      event: "dataset:datasets:created",
                      label: "Dataset Created",
                      desc: "Triggered when a dataset is created",
                      allowed_roles: %w[admin org_owner user],
                      payload: ->(m) { { dataset: Handlers.fetch(:datasets, Handlers.resource_id(m)) } }

      Handlers.define "dataset.dataset.deleted",
                      event: "dataset:datasets:deleted",
                      label: "Dataset Deleted",
                      desc: "Triggered when a dataset is deleted",
                      allowed_roles: %w[admin org_owner user],
                      payload: ->(m) {
                        { dataset: { id: Handlers.resource_id(m), project_id: Handlers.metadata(m)[:project_id] } }
                      }

      Handlers.define "dataset.dataset.completed",
                      event: "dataset:datasets:completed",
                      label: "Dataset Completed",
                      desc: "Triggered when every entry of a dataset is completed",
                      allowed_roles: %w[admin org_owner user],
                      payload: ->(m) { { dataset: Handlers.fetch(:datasets, Handlers.resource_id(m)) } }

      Handlers.define "dataset.entry.completed",
                      event: "dataset:entries:submitted",
                      label: "Entry Completed",
                      desc: "Triggered when an entry completes its workflow",
                      allowed_roles: %w[admin org_owner user],
                      match: ->(m) { Handlers.changes(m)[:wf_step] == "done" },
                      payload: ->(m) { { entry: Handlers.fetch(:entries, Handlers.resource_id(m)) } }
    end
  end
end
