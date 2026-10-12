# frozen_string_literal: true

# Adds actor attribution to repository event metadata without changing the
# repository's auth context.
#
# Some writes run on a system context (`Verse::Auth::Context[:system]`, empty
# metadata) because they are performed on behalf of a user (e.g. an invite that
# creates/expands an account) or as a cascade of another event. Those writes must
# stay plain system writes — the auth context must NOT carry the user's identity
# (a hybrid context could be mistaken for the user acting). Only the **event**
# records who triggered it.
#
# This module lets a caller attach the actor to the repository's metadata for the
# duration of a write:
#
#   accounts_system.with_actor(auth_context) { accounts_system.update!(...) }
#
# The actor is either:
#   - a `Verse::Auth::Context` → its `metadata[:id]`, `[:email]`, `[:role]`;
#   - an event metadata hash (from `message.content[:metadata]`) → its
#     `actor_account_*` keys as they are;
#   - `nil` → no actor is set (the block still runs).
module ActorEventMetadata
  # For the duration of the block, sets the actor on the repository's metadata,
  # then restores the previous metadata (same pattern as `with_metadata`,
  # including `ensure`).
  def with_actor(actor)
    old_metadata = @metadata
    @metadata = @metadata.dup

    actor_metadata = actor_metadata_for(actor)
    @metadata.merge!(actor_metadata) if actor_metadata

    yield
  ensure
    @metadata = old_metadata
  end

  # Used by a repository's `add_event_metadata`: when the repository's auth
  # context has an identity (`auth_context.metadata[:id]` present), it wins;
  # otherwise keep the actor set by `with_actor`. Never overwrite an existing
  # actor with `nil`.
  def actor_event_metadata
    if auth_context.metadata[:id]
      {
        actor_account_id: auth_context.metadata[:id],
        actor_account_email: auth_context.metadata[:email],
        actor_account_role_name: auth_context.metadata[:role]
      }
    else
      @metadata.slice(:actor_account_id, :actor_account_email, :actor_account_role_name)
    end
  end

  private

  def actor_metadata_for(actor)
    case actor
    when Verse::Auth::Context
      return nil unless actor.metadata[:id]

      {
        actor_account_id: actor.metadata[:id],
        actor_account_email: actor.metadata[:email],
        actor_account_role_name: actor.metadata[:role]
      }
    when Hash
      {
        actor_account_id: actor[:actor_account_id],
        actor_account_email: actor[:actor_account_email],
        actor_account_role_name: actor[:actor_account_role_name]
      }
    end
  end
end