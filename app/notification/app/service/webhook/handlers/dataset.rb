# frozen_string_literal: true

module Webhook
  module Handlers
    module Dataset
      Handlers.define "dataset.project.created",
                      event: "dataset:projects:created",
                      label: "Project Created",
                      desc: "Triggered when a project is created",
                      allowed_roles: %w[admin org_owner]

      Handlers.define "dataset.project.updated",
                      event: "dataset:projects:updated",
                      label: "Project Updated",
                      desc: "Triggered when a project is updated",
                      allowed_roles: %w[admin org_owner user]

      Handlers.define "dataset.project.deleted",
                      event: "dataset:projects:deleted",
                      label: "Project Deleted",
                      desc: "Triggered when a project is deleted",
                      allowed_roles: %w[admin org_owner]

      Handlers.define "dataset.project.member.added",
                      event: "dataset:project_members:created",
                      label: "Project Member Added",
                      desc: "Triggered when a member is added to a project",
                      allowed_roles: %w[admin org_owner user]

      Handlers.define "dataset.project.member.role_updated",
                      event: "dataset:project_members:updated",
                      label: "Project Member Role Updated",
                      desc: "Triggered when a project member's role is changed",
                      allowed_roles: %w[admin org_owner user]

      Handlers.define "dataset.project.member.removed",
                      event: "dataset:project_members:updated",
                      label: "Project Member Removed",
                      desc: "Triggered when a member is removed from a project",
                      allowed_roles: %w[admin org_owner user]

      Handlers.define "dataset.dataset.created",
                      event: "dataset:datasets:created",
                      label: "Dataset Created",
                      desc: "Triggered when a dataset is created",
                      allowed_roles: %w[admin org_owner user]

      Handlers.define "dataset.dataset.deleted",
                      event: "dataset:datasets:deleted",
                      label: "Dataset Deleted",
                      desc: "Triggered when a dataset is deleted",
                      allowed_roles: %w[admin org_owner user]

      Handlers.define "dataset.dataset.completed",
                      event: "dataset:datasets:completed",
                      label: "Dataset Completed",
                      desc: "Triggered when every entry of a dataset is completed",
                      allowed_roles: %w[admin org_owner user]

      Handlers.define "dataset.entry.completed",
                      event: "dataset:entries:submitted",
                      label: "Entry Completed",
                      desc: "Triggered when an entry completes its workflow",
                      allowed_roles: %w[admin org_owner user]
    end
  end
end
