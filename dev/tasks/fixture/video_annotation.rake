require "httparty"
require "json"

namespace :fixture do

  desc "Upload video annotation fixture"
  task :upload_video_annotation do
    define_method(:assert) do |condition, message|
      raise message unless condition
    end

    api_url = "https://idah.localhost:8443/api/v1"
    # Get the token from the iam service
    token = `docker-compose exec iam bundle exec rake token:generate`.chomp.split(' ').last

    # Upload the video to media service
    media_uid = 16.times.map{ rand(0..36).to_s(36) }.join
    media_api_url = [api_url, "media"].join("/")
    video_path = "app/media/spec_data/4k_sample.mp4"
    upload_response = HTTParty.post(
      "#{media_api_url}/medias/files/#{media_uid}",
      headers: { "Authorization" => "Bearer #{token}" },
      body: { file: File.open(video_path) },
      verify: false
    )
    assert(upload_response.code == 201, "Failed to upload video: #{upload_response.body}")
    video_id = JSON.parse(upload_response.body)["id"]
    assert(upload_response.code == 201, "Failed to upload video: #{upload_response.body}")
    puts "Video uploaded with id: #{video_id}"
    exit!

    # Process the video
    HTTParty.post(
      "#{media_api_url}/videos/#{video_id}/process",
      headers: { "Authorization" => "Bearer #{token}" }
    )
    puts "Video processing started"

    # Create a project
    dataset_api_url = "https://idah.localhost:8443/api/dataset/v1"
    project_response = HTTParty.post(
      "#{dataset_api_url}/projects",
      headers: { "Authorization" => "Bearer #{token}", "Content-Type" => "application/json" },
      body: {
        name: "Video Annotation Fixture Project",
        description: "A project created from a rake task for video annotation.",
        data_type: "video"
      }.to_json
    )
    project_id = JSON.parse(project_response.body)["id"]
    puts "Project created with id: #{project_id}"

    # Create an entry
    entry_response = HTTParty.post(
      "#{dataset_api_url}/entries",
      headers: { "Authorization" => "Bearer #{token}", "Content-Type" => "application/json" },
      body: {
        project_id: project_id,
        video_id: video_id
      }.to_json
    )
    entry_id = JSON.parse(entry_response.body)["id"]
    puts "Entry created with id: #{entry_id}"

    puts "Fixture generation complete!"
  end
end
