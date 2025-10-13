RSpec.describe ProcessorExpo, type: :exposition, as: :system do
  context "#process_entry_created" do
    it "responds to entry created events" do
      expect_any_instance_of(Video::Service).to receive(:process_entry_created) do |service, resource_id|
        expect(resource_id).to eq "some-id"
      end

      Verse.publish_resource_event(
        resource_type: Resource::Dataset::Entries,
        resource_id: "some-id",
        event: "created",
        payload: {}
      )
    end

  end
end