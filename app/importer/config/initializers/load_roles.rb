# frozen_string_literal: true

# Load the roles into the local RoleRepository

Verse.on_boot do
  Model::RoleRepository.load
  Verse::Auth::Context.backend = Service::RoleBackend.new
end
