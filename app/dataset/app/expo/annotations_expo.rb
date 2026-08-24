# frozen_string_literal: true

class AnnotationsExpo < BaseExpo
  http_path "/annotations"

  use_service Annotation::Service

  desc <<~MD
    Annotations capture labeled data or markups on entries,
    supporting both JSON:API and JSON-RPC interfaces for flexible batch operations.

    NOTE: Deleted (soft-deleted) annotations are returned by default by `index`/`show`.
    Use the `deleted` filter ("true"/"false") to narrow results explicitly.
  MD

  json_api Annotation::Record do
    show
    index do
      allowed_filters :updated_at__gt, :deleted
    end
    create do
      authorized_relationships entry: [:link]
    end
    update
    delete
  end

  # Offer RPC interface for annotations, less verbose and more convenient for
  # fast updates and queries.
  json_rpc http_path: "_rpc", batch_limit: 50, batch_failure: :stop

  expose json_rpc_method(:show) do
    input do
      field(:id, String)
    end
  end
  def rpc_show
    service.show(params[:id])
  end

  RpcCreateSchema = Verse::Schema.define do
    field(:id, String).default { UUIDv7.generate }
    field(:entry_id, String)
    field(:shape_type, String)
    field(:shape_args, Hash) # Open Hash
    field(:category, String) # required
    field?(:properties, Hash) # Open Hash, optional
    field?(:metadata, Hash) # Open Hash
  end

  # Add the id as a required field for the update method.
  # All mutable fields are omittable on update — omitted means "leave
  # unchanged", never "clear it".
  RpcUpdateSchema = Verse::Schema.define(RpcCreateSchema) do
    field(:id, String)
    field?(:shape_type, String)
    field?(:shape_args, Hash)
    field?(:category, String)
    field?(:properties, Hash)
  end

  expose json_rpc_method(:create) do
    input RpcCreateSchema
  end
  def rpc_create
    service.create(
      Verse::JsonApi::Deserializer.deserialize(
        {
          data: {
            id: params[:id],
            attributes: params,
            relationships: {
              entry: {
                data: { type: "entries", id: params[:entry_id] }
              }
            }
          }
        }
      )
    )
  end

  expose json_rpc_method(:update) do
    input RpcUpdateSchema
  end
  def rpc_update
    service.update_attr(
      params[:id],
      params.except(:id)
    )
  end

  expose json_rpc_method(:delete) do
    input do
      field(:id, String)
    end
  end
  def rpc_delete
    service.delete(params[:id])
  end

  expose json_rpc_method(:restore) do
    input do
      field(:id, String)
    end
  end
  def rpc_restore
    service.restore(params[:id])
  end

  expose json_rpc_method(:write_shape) do
    input do
      field(:annotation_id, String)
      field(:key, String)
      field?(:value) # nil (delete) or Hash (upsert)
    end
  end
  def rpc_write_shape
    service.write_shape(
      params[:annotation_id],
      params[:key],
      params[:value]
    )
  end
end
