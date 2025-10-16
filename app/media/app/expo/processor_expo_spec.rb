RSpec.describe ProcessorExpo, type: :exposition, as: :system do
  context "#on_entry_created" do
    it "responds to entry created events" do
      SCHEDULER.pause do
        expect_any_instance_of(Processor::Service).to receive(:process_entry) do |service, resource_id|
          expect(resource_id).to eq "some-id"
        end

        Verse.publish_resource_event(
          resource_type: Resource::Dataset::Entries,
          resource_id: "some-id",
          event: "created",
          payload: {
            resource_id: "some-id",
            args: [],
            metadata: {}
          }
        )
      end
    end
  end
end