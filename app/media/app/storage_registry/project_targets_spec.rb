# frozen_string_literal: true

require "spec_helper"

# StorageRegistry::ProjectTargets lives in common/lib; it is specced here.
RSpec.describe StorageRegistry::ProjectTargets do
  let(:project_id) { "0194f5a2-0000-7000-8000-0000000000aa" }
  let(:target_id) { "0194f5a2-0000-7000-8000-000000000001" }
  let(:url) { "https://idah.example.com/api/v1/dataset/projects/#{project_id}" }

  def project_body(storage_target_id)
    {
      data: {
        type: Resource::Dataset::Projects,
        id: project_id,
        attributes: { name: "Confidential", organization_id: 1, storage_target_id: }
      }
    }.to_json
  end

  before do
    # spec_helper stubs this for every other spec.
    allow(described_class).to receive(:for).and_call_original
    described_class.reset!
    stub_request(:post, "https://idah.example.com/api/v1/iam/auth/login")
      .to_return(status: 200, body: %({ "data": {} }))
  end

  after { described_class.reset! }

  it "gives the project's storage target" do
    stub_request(:get, url).to_return(status: 200, body: project_body(target_id))

    expect(described_class.for(project_id)).to eq(target_id)
  end

  it "gives nil for a project in the default storage" do
    stub_request(:get, url).to_return(status: 200, body: project_body(nil))

    expect(described_class.for(project_id)).to be_nil
  end

  it "asks once per project, since a project's target never changes, nil included" do
    stub_request(:get, url).to_return(status: 200, body: project_body(nil))

    3.times { described_class.for(project_id) }

    expect(a_request(:get, url)).to have_been_made.once
  end

  it "gives nil for a project dataset doesn't know, so its files keep going to the default storage" do
    stub_request(:get, url).to_return(status: 404, body: %({ "errors": [] }))

    expect(described_class.for(project_id)).to be_nil
  end

  it "raises other failures and asks again next time" do
    stub_request(:get, url).to_return({ status: 500, body: "{}" }, { status: 200, body: project_body(target_id) })

    expect { described_class.for(project_id) }.to raise_error(Api::HTTPError)
    expect(described_class.for(project_id)).to eq(target_id)
  end
end
