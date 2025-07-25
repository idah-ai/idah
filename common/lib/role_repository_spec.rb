# frozen_string_literal: true

RSpec.describe Model::RoleRepository, type: :repository do
  it "load the roles" do
    Model::RoleRepository.load

    expect(Model::RoleRepository.data).not_to be_empty
  end
end
