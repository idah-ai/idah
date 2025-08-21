require "httparty"
require "json"
require "pry"

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
    media_uid = 16.times.map{ rand(0..36).to_s(36) }.join + ".mp4"
    media_api_url = [api_url, "media"].join("/")
    video_path = "app/media/spec_data/4k_sample.mp4"
    upload_response = HTTParty.post(
      "#{media_api_url}/medias/files/#{media_uid}",
      headers: { "Authorization" => "Bearer #{token}" },
      body: { file: File.open(video_path) },
      verify: false
    )
    assert(upload_response.code < 399, "Failed to upload video: #{upload_response.code} - #{upload_response.body}")
    result = JSON.parse(upload_response.body, symbolize_names: true)
    assert(upload_response.code < 399, "Failed to upload video: #{upload_response.code} - #{upload_response.body}")

    video_resource = result[:data][:attributes][:resource]

    puts "Video uploaded as resource: #{video_resource}"

    # Process the video
    process_response = HTTParty.post(
      "#{media_api_url}/videos/process",
      body: {
        data: {
          resource: video_resource
        }
      },
      headers: { "Authorization" => "Bearer #{token}" },
      verify: false
    )
    puts "Video processing started"
    assert(process_response.code < 399, "Failed to process video: #{upload_response.code} - #{upload_response.body}")
    result = JSON.parse(process_response.body, symbolize_names: true)

    puts "Video processing job created with id: #{result}"
    job_id = result[:data][:id]

    loop do
      job_response = HTTParty.get(
        "#{media_api_url}/jobs/#{job_id}",
        headers: { "Authorization" => "Bearer #{token}" },
        verify: false
      )
      assert(job_response.code < 399, "Failed to get job status: #{job_response.code} - #{job_response.body}")
      job_result = JSON.parse(job_response.body, symbolize_names: true)

      if job_result[:data][:attributes][:status] == "completed"
        puts "Video processing completed successfully"
        video_id = job_result[:data][:attributes][:video_id]
        break
      elsif job_result[:data][:attributes][:status] == "failed"
        raise "Video processing failed"
      end

      puts "[#{job_result[:data][:attributes][:status]}] Progress = #{(job_result[:data][:attributes][:progress]*100).round}%"
      sleep 1.0
    end

    # Create a project
    dataset_api_url = "https://idah.localhost:8443/api/v1/dataset"
    project_response = HTTParty.post(
      "#{dataset_api_url}/projects",
      headers: { "Authorization" => "Bearer #{token}", "Content-Type" => "application/json" },
      body: {
        data: {
          type: "dataset:projects",
          attributes: {
            name: "Video Annotation Fixture Project",
            description: "A project created from a rake task for video annotation.",
          }
        }
      }.to_json,
      verify: false
    )

    assert(project_response.code < 399, "Failed to create project: #{project_response.code} - #{project_response.body}")

    project_id = JSON.parse(project_response.body)["data"]["id"]
    puts "Project created with id: #{project_id}"

    # Create a datasetq
    dataset_response = HTTParty.post(
      "#{dataset_api_url}/datasets",
      headers: { "Authorization" => "Bearer #{token}", "Content-Type" => "application/json" },
      body: {
        data: {
          type: "dataset:datasets",
          attributes: {
            modality: "video",
            labels: ["demo", "fixture"],
            workflow_configuration: {
              type: "annotate_qc",
              opts: { sample_rate: 1.0 }
            },
            labeling_configuration: {
              properties: [
                {
                  id: "order",
                  type: "integer",
                  format: {
                    minimum: 0,
                    maximum: 1000
                  },
                  label: "Order",
                  description: "Order of the annotation in the video",
                  required: true,
                  selector: ["vehicle/*"],
                }
              ],
              categories: [
                {
                  id: "vehicle/car",
                  label: "Car",
                  type: "video:bounding_box",
                  color: "#FF0000"
                },
                {
                  id: "vehicle/bike",
                  label: "Bike",
                  type: "video:bounding_box",
                  color: "#00FF00"
                },
                {
                  id: "person",
                  label: "Person",
                  type: "video:bounding_box",
                  color: "#0000FF"
                },
                {
                  id: "vehicle/other",
                  label: "Other Vehicle",
                  type: "video:bounding_box",
                  color: "#FFFF00"
                },
              ]
            }
          },
          relationships: {
            project: {
              data: {
                labeling_configuration: {},
                workflow_configuration: {},
                type: "dataset:projects",
                id: project_id
              }
            }
          }
        }
      }.to_json,
      verify: false
    )
    assert(dataset_response.code < 399, "Failed to create dataset: #{dataset_response.code} - #{dataset_response.body}")
    dataset_id = JSON.parse(dataset_response.body)["data"]["id"]

    # Create an entry
    entry_response = HTTParty.post(
      "#{dataset_api_url}/entries",
      headers: { "Authorization" => "Bearer #{token}", "Content-Type" => "application/json" },
      body: {
        data: {
          type: "dataset:entries",
          attributes: {
            dataset_id: JSON.parse(dataset_response.body)["data"]["id"],
            resource: video_resource,
          },
          relationships: {
            dataset: {
              data: {
                type: "dataset:datasets",
                id: dataset_id
              }
            }
          }
        }
      }.to_json,
      verify: false
    )
    assert(entry_response.code < 399, "Failed to create entry: #{entry_response.code} - #{entry_response.body}")
    entry_id = JSON.parse(entry_response.body)["data"]["id"]
    puts "Entry created with id: #{entry_id}"

    puts "Fixture generation complete!"
  end
end
