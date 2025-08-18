# frozen_string_literal: true

class AnnotationsExpo < BaseExpo
  http_path "/annotations"

  use_service Annotation::Service

  json_api Annotation::Record, http_opts: { auth:nil } do
    show
    index
    create do
      authorized_relationships entry: [:link]
    end
    update
    delete
  end

  # Offer RPC interface for annotations, less verbose and more convenient for
  # fast updates and queries.
  json_rpc http_path: "_rpc", batch_limit: 50, batch_failure: :stop, http_opts: { auth: nil }

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
    field(:entry_id, Integer)
    field(:dimensions, Hash) # Open Hash
    field(:annotation, Hash) # Open Hash

    field(:type, String)
  end

  # Add the id as a required field for the update method
  RpcUpdateSchema = Verse::Schema.define(RpcCreateSchema) do
    field(:id, String)
  end

  expose json_rpc_method(:create) do
    input RpcCreateSchema
  end
  def rpc_create
    service.create(params)
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
end
