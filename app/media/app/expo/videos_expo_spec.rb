# frozen_string_literal: true

RSpec.describe VideosExpo, type: :exposition, as: :system do
  context "#process" do
    it "schedules a video for processing" do
      arguments = {
        resource: "some-resource"
      }

      expect_any_instance_of(Video::Service).to receive(:process) do |service, args|
        expect(args[:resource]).to eq "some-resource"
      end

      post "/videos/process", { data: arguments }

      expect(last_response.status).to eq 201

    end
  end
end
