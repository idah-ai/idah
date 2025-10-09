# frozen_string_literal: true

class PermissionSetRepository < Verse::Model::InMemory::Repository
  self.primary_key = "name"
  self.resource = "iam:permission_sets"

  PERMISSION_SET_PATH = File.join(COMMON_PATH, "/data/permission_sets")
  NO_DESC = "There is no description for this permission set"

  def self.load
    data.clear

    repo = new(Verse::Auth::Context.new)

    Dir.glob("#{PERMISSION_SET_PATH}/**/*.yml").each do |file|
      next if file =~ /templates/ # ignore templates

      repo.load_permission_set(YAML.safe_load(File.read(file)))
    end
  end

  def load_permission_set(hash)
    no_event do
      hash.each do |name, attribute|
        create(
          {
            name:,
            title: attribute.fetch("title", name),
            rights: attribute["rights"],
            description: attribute.fetch("description", NO_DESC),
            assignable: attribute.fetch("assignable", false)
          }
        )
      end
    end
  end
end
