# frozen_string_literal: true

# Config-data migration — rewrite persisted AST visibility-rule paths in
# `labeling_configuration` (datasets + label_config_templates)
#
# 1. Strip the `annotation.` prefix from every AST visibility-rule path and
#    rename the property-bag key from `attributes` to `properties`:
#    ["get", "annotation.category"]            → ["get", "category"]
#    ["get", "annotation.attributes.<key>"]    → ["get", "properties.<key>"]
#    (handles `and`/`or` nesting recursively)
#
Sequel.migration do
  # The migration rake task connects without the app's sequel plugin config,
  # so load the pg_json extension here to make Sequel.pg_jsonb available.
  Sequel.extension :pg_json

  def self.migrate_ast(node)
    return node unless node.is_a?(Array)

    if node[0] == "get" && node[1].is_a?(String) && node[1].start_with?("annotation.")
      path = node[1].sub("annotation.", "")
      # The property bag was renamed from `attributes` to `properties`.
      path = path.sub(/\Aattributes\./, "properties.")
      ["get", path]
    else
      node.map { |n| n.is_a?(Array) ? migrate_ast(n) : n }
    end
  end

  def self.unmigrate_ast(node)
    return node unless node.is_a?(Array)

    if node[0] == "get" && node[1].is_a?(String) && !node[1].start_with?("annotation.")
      path = node[1]
      # Reverse the property-bag rename: `properties.` → `attributes.`.
      path = path.sub(/\Aproperties\./, "attributes.")
      ["get", "annotation.#{path}"]
    else
      node.map { |n| n.is_a?(Array) ? unmigrate_ast(n) : n }
    end
  end

  def self.migrate_config(config)
    return config unless config.is_a?(Hash)

    config = config.dup
    config.delete("category_field")
    config.delete(:category_field)

    config.each do |_key, tool_config|
      next unless tool_config.is_a?(Hash)

      properties = tool_config["properties"] || tool_config[:properties]
      next unless properties.is_a?(Array)

      properties.each do |prop|
        next unless prop.is_a?(Hash)

        vis = prop["visibility"] || prop[:visibility]
        next unless vis.is_a?(Array)

        migrated = migrate_ast(vis)
        if prop.key?("visibility")
          prop["visibility"] = migrated
        else
          prop[:visibility] = migrated
        end
      end
    end

    config
  end

  def self.unmigrate_config(config)
    return config unless config.is_a?(Hash)

    config = config.dup

    config.each do |_key, tool_config|
      next unless tool_config.is_a?(Hash)

      properties = tool_config["properties"] || tool_config[:properties]
      next unless properties.is_a?(Array)

      properties.each do |prop|
        next unless prop.is_a?(Hash)

        vis = prop["visibility"] || prop[:visibility]
        next unless vis.is_a?(Array)

        unmigrated = unmigrate_ast(vis)
        if prop.key?("visibility")
          prop["visibility"] = unmigrated
        else
          prop[:visibility] = unmigrated
        end
      end
    end

    config
  end

  up do
    # datasets
    from(:datasets).where(Sequel.~(labeling_configuration: nil)).each do |row|
      config = row[:labeling_configuration]
      next unless config.is_a?(Hash)

      migrated = self.class.migrate_config(config)
      from(:datasets).where(id: row[:id]).update(labeling_configuration: Sequel.pg_jsonb(migrated))
    end

    # label_config_templates
    from(:label_config_templates).where(Sequel.~(labeling_configuration: nil)).each do |row|
      config = row[:labeling_configuration]
      next unless config.is_a?(Hash)

      migrated = self.class.migrate_config(config)
      from(:label_config_templates).where(id: row[:id]).update(labeling_configuration: Sequel.pg_jsonb(migrated))
    end
  end

  down do
    # datasets
    from(:datasets).where(Sequel.~(labeling_configuration: nil)).each do |row|
      config = row[:labeling_configuration]
      next unless config.is_a?(Hash)

      unmigrated = self.class.unmigrate_config(config)
      from(:datasets).where(id: row[:id]).update(labeling_configuration: Sequel.pg_jsonb(unmigrated))
    end

    # label_config_templates
    from(:label_config_templates).where(Sequel.~(labeling_configuration: nil)).each do |row|
      config = row[:labeling_configuration]
      next unless config.is_a?(Hash)

      unmigrated = self.class.unmigrate_config(config)
      from(:label_config_templates).where(id: row[:id]).update(labeling_configuration: Sequel.pg_jsonb(unmigrated))
    end
  end
end
