# frozen_string_literal: true

RSpec.describe VideosExpo, type: :exposition, as: :system do
  context "#process" do
    it "schedules a video for processing" do
      arguments = {
        resource: "some-resource"
      }

      expect_any_instance_of(Video::Service).to receive(:process).with(
        arguments
      )

      post "/videos/process", { data: arguments }
      puts last_response.body
      expect(last_response.status).to eq 204
    end
  end
end
