# frozen_string_literal: true

RSpec.describe Service::RoleBackend, type: :service do
  before do
    Model::RoleRepository.load
  end

  context "when fetching roles" do
    let(:role) { "staff" }

    it "returns the rights for a role" do
      rights = subject.fetch(role)
      expect(rights).to be_an(Array)
    end

    it "raises an error if the role does not exist" do
      expect { subject.fetch("nonexistent") }.to raise_error(Verse::Error::Authorization)
    end

    context "compound rights" do
      let(:role) { "api:wf_ro_proj,wf_p" }

      it "returns the rights for a compound role" do
        rights = subject.fetch(role)
        expect(rights).to be_an(Array)
      end
    end
  end
end
