# frozen_string_literal: true

module AccountSettings
  module Defaults
    # Each entry becomes one account_settings row, addressed by (key, plugin).
    # Keep string keys/plugins to put in db. plugin "" means a core setting.
    DEFAULT_ACCOUNT_SETTINGS = [
      # notifications
      { key: "notification:organization:activities", plugin: "", value: true },
      { key: "notification:project:activities", plugin: "", value: true },
      # command palette shortcut overrides — { "<command-name>" => "<shortcut>" }
      { key: "command:shortcut", plugin: "", value: {} },
      # annotation category label visibility — "always" | "hover" | "never".
      # Stored per plugin so image and video preferences stay independent.
      { key: "annotation:category.label-visibility", plugin: "idah-image", value: "never" },
      { key: "annotation:category.label-visibility", plugin: "idah-video", value: "never" },
    ].freeze
  end
end
