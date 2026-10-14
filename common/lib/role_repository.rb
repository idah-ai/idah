# frozen_string_literal: true

class RoleRepository < Verse::Model::InMemory::Repository
  self.primary_key = "name"
  self.resource = "iam:roles"

  ROLE_PATH = File.join(COMMON_PATH, "/data/roles")
  PROJECT_ROLE_PATH = File.join(COMMON_PATH, "/data/project_roles.yml")
  NO_DESC = "There is no description for this role"

  # Project role masks (name => mask), loaded from `common/data/project_roles.yml`.
  # Kept separate from account roles so project roles are never visible as
  # account roles to RoleBackend or the assignable lists.
  def self.project_role_masks
    @project_role_masks ||= load_project_role_masks
  end

  def self.load
    data.clear

    repo = new(Verse::Auth::Context.new)

    Dir.glob("#{ROLE_PATH}/**/*.yml").each do |file|
      next if file =~ /templates/ # ignore templates

      repo.load_role(YAML.safe_load(File.read(file)))
    end
  end

  def self.load_project_role_masks
    hash = YAML.safe_load(File.read(PROJECT_ROLE_PATH)) || {}

    hash.each_with_object({}) do |(name, attribute), out|
      out[name.to_s] = attribute.fetch("mask", "0.0.0")
    end.freeze
  end

  # All role masks (account + project roles, name => mask). Account roles come
  # from the in-memory RoleRepository rows; project roles from project_role_masks.
  def self.role_masks
    account = data.each_with_object({}) do |row, out|
      out[row[:name]] = row[:mask]
    end

    account.merge(project_role_masks)
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
            mask: attribute.fetch("mask", "0.0.0"),
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
