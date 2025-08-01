# frozen_string_literal: true

require_relative "../lib/role_repository"

RSpec.describe RoleRepository, type: :repository do
  it "load the roles" do
    RoleRepository.load

    expect(RoleRepository.data).not_to be_empty
  end
end
