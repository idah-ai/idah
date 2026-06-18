# Database Migrations

## Framework
Sequel migration DSL (NOT ActiveRecord). Migrations live in `app/{service}/db/migrations/` with timestamp-prefixed filenames: `YYYYMMDDHHMMSS_description.rb`.

## File Format
```ruby
Sequel.migration do
  up do
    # Create tables, add columns, create triggers
  end
  down do
    # Reversible operations
  end
end
```

## Migration Syntax Examples

### Create Table
```ruby
create_table(:accounts) do
  column :id, :bigint, primary_key: true
  String :name, null: false
  String :email, null: false, unique: true
  String :hashed_password, null: false
  TrueClass :enabled, default: true
  DateTime :created_at, null: false, default: Sequel::CURRENT_TIMESTAMP
  DateTime :updated_at, null: false, default: Sequel::CURRENT_TIMESTAMP

  foreign_key :organization_id, :organizations, type: :bigint, null: true, on_delete: :cascade
  index :email, unique: true
end
```

### Add Column
```ruby
alter_table(:project_members) do
  add_column :disabled_at, DateTime, null: true, index: true
end
```

### Custom SQL / Extensions
```ruby
run "CREATE EXTENSION IF NOT EXISTS pgcrypto"

run <<~SQL
  CREATE OR REPLACE FUNCTION update_dataset_entry_counters()
  RETURNS TRIGGER AS $$
  BEGIN
    IF TG_OP = 'INSERT' THEN
      UPDATE datasets SET entries_total_count = entries_total_count + 1 WHERE id = NEW.dataset_id;
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE datasets SET entries_total_count = entries_total_count - 1 WHERE id = OLD.dataset_id;
    END IF;
    RETURN NULL;
  END;
  $$ LANGUAGE plpgsql;
SQL
```

### Create Trigger
```ruby
create_trigger(:entries, :trg_update_dataset_on_entry_change, :update_dataset_entry_counters, 
  events: [:insert, :update, :delete], each_row: true)
```

### Enable UUID Functions
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- UUID v7 function
CREATE OR REPLACE FUNCTION uuid_generate_v7()
RETURNS uuid AS $$
  ...
$$ LANGUAGE plpgsql;
```

## UUID v7
UUIDv7.generate for Ruby-generated UUIDs. PostgreSQL also has `uuid_generate_v7()` function in some migrations.

## Data Types
- Primary keys: `:bigint` or uuid
- JSONB: `column :arguments, :jsonb` (encoder in Repository)
- Timestamps: `DateTime`, default `Sequel::CURRENT_TIMESTAMP`
- Booleans: `TrueClass`, `FalseClass`

## Triggers Common in Dataset Service
- Counter triggers on entries → datasets (total/completed/in_progress)
- Updated-at cascade triggers (annotation→entry→dataset→project)

## Key Rules
- All migrations are reversible (define both up and down)
- Use `create_trigger` helper over raw SQL triggers where possible
- Foreign keys use `on_delete: :cascade`
- Index frequently queried columns
- No ActiveRecord syntax (no t.timestamps, t.references, etc.)
