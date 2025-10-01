class Manifest
  Schema = Verse::Schema.define do
    field(:type, String).rule("should be 'idah-plugin'") { _1 == "idah-plugin" }

    field :name, String
    field(:version, String).rule("should be a valid semver") { _1.match?(/\A\d+\.\d+\.\d+(\-[0-9A-Za-z-.]+)?(\+[0-9A-Za-z-.]+)?\z/) }

    field? :description, String

    field? :frontendMountingPoint, String
    field? :backendFolder, String
  end

end