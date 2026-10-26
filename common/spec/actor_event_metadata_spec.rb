# frozen_string_literal: true

require "rspec"
require_relative "../lib/actor_event_metadata"

RSpec.describe ActorEventMetadata do
  # A minimal repository-like object that includes the module, exposing the
  # metadata an emitted event would carry. `initialize` mirrors a real
  # repository: it calls `super` (here a no-op base) so the module's
  # `initialize` can seed the actor.
  class FakeBase
    def initialize(_auth_context)
      @metadata = {}
    end

    def add_metadata(**opts)
      @metadata.merge!(opts)
    end
  end

  class FakeRepo < FakeBase
    include ActorEventMetadata

    attr_reader :auth_context

    # Simulates what a repository's add_event_metadata does: return the current
    # metadata as an event would carry it.
    def emit
      @metadata
    end
  end

  def system_context
    Verse::Auth::Context.new(["*.*.*"], role: :system, metadata: {})
  end

  def user_context
    Verse::Auth::Context.new(
      ["iam:accounts.*.*"],
      role: :admin,
      metadata: { id: 7, email: "admin@example.com", role: :admin }
    )
  end

  describe "actor seeding from the auth context" do
    it "seeds the actor from a request context at construction" do
      repo = FakeRepo.new(user_context)

      expect(repo.emit).to include(
        actor_account_id: 7,
        actor_account_email: "admin@example.com",
        actor_account_role_name: :admin
      )
    end

    it "seeds nothing for a system context" do
      repo = FakeRepo.new(system_context)

      expect(repo.emit).not_to have_key(:actor_account_id)
    end
  end

  describe "#with_actor" do
    it "sets the actor on the emitted metadata for the duration of the block" do
      repo = FakeRepo.new(system_context)

      emitted = repo.with_actor(user_context) { repo.emit }

      expect(emitted).to include(
        actor_account_id: 7,
        actor_account_email: "admin@example.com",
        actor_account_role_name: :admin
      )
    end

    it "overrides the seeded actor for the block" do
      repo = FakeRepo.new(user_context)
      other = Verse::Auth::Context.new(
        ["iam:accounts.*.*"],
        role: :org_owner,
        metadata: { id: 9, email: "owner@example.com", role: :org_owner }
      )

      emitted = repo.with_actor(other) { repo.emit }

      expect(emitted).to include(
        actor_account_id: 9,
        actor_account_email: "owner@example.com",
        actor_account_role_name: :org_owner
      )
    end

    it "accepts an event metadata hash" do
      repo = FakeRepo.new(system_context)
      actor = { actor_account_id: 9, actor_account_email: "inviter@example.com", actor_account_role_name: "org_owner" }

      emitted = repo.with_actor(actor) { repo.emit }

      expect(emitted).to include(
        actor_account_id: 9,
        actor_account_email: "inviter@example.com",
        actor_account_role_name: "org_owner"
      )
    end

    it "restores the previous metadata after the block" do
      repo = FakeRepo.new(system_context)

      repo.with_actor(user_context) { repo.emit }

      expect(repo.emit).not_to have_key(:actor_account_id)
    end

    it "restores the previous metadata when the block raises" do
      repo = FakeRepo.new(system_context)

      expect {
        repo.with_actor(user_context) { raise "boom" }
      }.to raise_error("boom")

      expect(repo.emit).not_to have_key(:actor_account_id)
    end

    it "does not set an actor when nil is passed" do
      repo = FakeRepo.new(system_context)

      emitted = repo.with_actor(nil) { repo.emit }

      expect(emitted).not_to have_key(:actor_account_id)
    end
  end
end