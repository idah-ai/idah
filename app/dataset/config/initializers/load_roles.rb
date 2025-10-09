# frozen_string_literal: true

Verse.on_boot do
  RoleRepository.load
  PermissionSetRepository.load
  Verse::Auth::Context.backend = RoleBackend.new
end
