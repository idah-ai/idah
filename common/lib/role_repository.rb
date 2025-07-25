# frozen_string_literal: true

class RoleRepository < Verse::Model::InMemory::Repository
  self.primary_key = "name"
  self.resource = "iam:roles"

  ROLE_PATH = File.join(COMMON_PATH, "/data/roles")
  NO_DESC = "There is no description for this role"

  def self.load
    data.clear

    repo = new(Verse::Auth::Context.new)

    Dir.glob("#{ROLE_PATH}/**/*.yml").each do |file|
      next if file =~ /templates/ # ignore templates

      repo.load_role(YAML.safe_load(File.read(file)))
    end
  end

  def find_template(file_name)
    @templates ||= {}

    return @templates[file_name] if @templates.key?(file_name)

    raise "Template #{file_name} not found" unless File.exist?(File.join(ROLE_PATH, "templates", "#{file_name}.yml"))

    template = YAML.safe_load(
      File.read(File.join(ROLE_PATH, "templates", "#{file_name}.yml"))
    )

    @templates[file_name] = template.fetch("resources", [])
  end

  # Fetch the template and unfold them
  # if any
  def unfold_rights(rights)
    rights.map{ |x|
      if x[0] == "$"
        template_name = x[1..]
        find_template(template_name)
      else
        x
      end
    }.flatten
  end

  def load_role(hash)
    no_event do
      hash.each do |name, attribute|
        create(
          {
            name:,
            title: attribute.fetch("title", name),
            rights: unfold_rights(attribute["rights"]),
            scopes: attribute.fetch("scopes", []),
            labels: attribute.fetch("labels", []),
            description: attribute.fetch("description", NO_DESC),
            assignable: attribute.fetch("assignable", false)
          }
        )
      end
    end
  end
end
