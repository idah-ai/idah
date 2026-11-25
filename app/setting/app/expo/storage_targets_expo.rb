# frozen_string_literal: true

class StorageTargetsExpo < BaseExpo
  http_path "/storage_targets"

  use_service StorageTargets::Service

  # Explicit input schemas: the secret comes in here and nowhere else, and the
  # columns the service sets (secret_hint, created_by, timestamps) can't.
  CREATE_SCHEMA = Verse::Schema.define do
    field(:name, String)
    field(:endpoint, String)
    field?(:region, [String, NilClass])
    field(:bucket, String)
    field?(:prefix, [String, NilClass])
    field?(:path_style, TrueClass)
    field(:access_key_id, String)
    field(:secret_access_key, String)
    field?(:organization_ids, Array)
    field?(:enabled, TrueClass)
  end

  # The location fields are accepted so a changed one is refused with a clear
  # error rather than dropped; an empty secret keeps the stored one.
  UPDATE_SCHEMA = Verse::Schema.define do
    field?(:name, String)
    field?(:endpoint, String)
    field?(:region, [String, NilClass])
    field?(:bucket, String)
    field?(:prefix, [String, NilClass])
    field?(:path_style, TrueClass)
    field?(:access_key_id, String)
    field?(:secret_access_key, [String, NilClass])
    field?(:organization_ids, Array)
    field?(:enabled, TrueClass)
  end

  # Declared before the JSON:API routes, whose `/:id` would take `_available`.
  expose on_http(:get, "/_available") do
    desc <<~MD
      The storage targets the caller may pick for a new project: enabled ones,
      allowed for one of their organizations (all of them for an admin). No
      credentials. With `organization_id`, only the targets a new project of
      that organization may use.
    MD
    input do
      field?(:organization_id, [Integer, NilClass])
    end
    output Verse::JsonApi::Util.jsonapi_collection(StorageTarget::Summary)
  end
  def available
    service.available(organization_id: params[:organization_id])
  end

  expose on_http(:post, "/_test") do
    desc "Test a storage target's location and credentials before saving it. Admin only."
    input do
      field(:endpoint, String)
      field?(:region, [String, NilClass])
      field(:bucket, String)
      field?(:prefix, [String, NilClass])
      field?(:path_style, TrueClass)
      field(:access_key_id, String)
      field(:secret_access_key, String)
    end
  end
  def test_connection
    service.test_connection(params)
  end

  expose on_http(:post, "/:id/_test") do
    desc "Test a saved storage target with its stored credentials. Admin only."
    input do
      field(:id, String)
    end
  end
  def test_saved
    service.test_saved(params[:id])
  end

  expose on_http(:get, "/:id/_credentials") do
    desc <<~MD
      A storage target's location and decrypted credentials, for the media and
      sync services, which store the files. System role only.
    MD
    input do
      field(:id, String)
    end
    output Verse::JsonApi::Util.jsonapi_record(StorageTarget::Credentials)
  end
  def credentials
    service.credentials(params[:id])
  end

  json_api StorageTarget::Record do
    index do
      allowed_filters :id__in, :name__match, :enabled, :bucket
    end
    show
    create do
      schema CREATE_SCHEMA
    end
    update do
      schema UPDATE_SCHEMA
    end
    delete
  end
end
