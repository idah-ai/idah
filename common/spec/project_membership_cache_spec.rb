# frozen_string_literal: true

require_relative "../lib/project_membership/cache"
require_relative "../lib/project_membership/lookup"

RSpec.describe ProjectMembership::Cache do
  subject { described_class.new(config) }

  let(:config) { {} }

  describe "#fetch" do
    context "with caching enabled (default)" do
      it "caches the block result across calls" do
        calls = 0
        2.times { subject.fetch("k", "s") { calls += 1; :value } }

        expect(calls).to eq(1)
        expect(subject.fetch("k", "s") { :other }).to eq(:value)
      end

      it "caches an empty array (distinguishable from a miss)" do
        calls = 0
        2.times { expect(subject.fetch("k", "s") { calls += 1; [] }).to eq([]) }

        expect(calls).to eq(1)
      end

      it "caches nil (distinguishable from a miss)" do
        calls = 0
        2.times { expect(subject.fetch("k", "s") { calls += 1; nil }).to be_nil }

        expect(calls).to eq(1)
      end

      it "expires entries after the TTL" do
        cache = described_class.new(ttl: 1)
        cache.fetch("k", "s") { :first }

        expect(cache.fetch("k", "s") { :second }).to eq(:first)

        sleep 1.1
        expect(cache.fetch("k", "s") { :second }).to eq(:second)
      end

      it "defaults the TTL to 300 seconds" do
        expect(subject.send(:ttl_seconds)).to eq(300)
      end

      it "never expires entries when ttl is explicitly nil" do
        cache = described_class.new(ttl: nil)
        cache.fetch("k", "s") { :value }

        expect(cache.fetch("k", "s") { :other }).to eq(:value)
      end

      it "rejects a ttl of 0" do
        expect { described_class.new(ttl: 0) }.to raise_error(ArgumentError, /must be a positive Integer/)
      end

      it "rejects a negative ttl" do
        expect { described_class.new(ttl: -5) }.to raise_error(ArgumentError, /must be a positive Integer/)
      end

      it "deep-freezes cached arrays of structs so callers cannot mutate the shared entry" do
        membership = ProjectMembership::Lookup::Membership.new(project_id: "p1", role: "reviewer", organization_id: 7)
        subject.fetch("k", "s") { [membership] }

        cached = subject.fetch("k", "s") { [] }

        expect(cached).to be_frozen
        expect(cached.first).to be_frozen
        expect { cached.first.project_id = "p2" }.to raise_error(FrozenError)
      end

      it "bounds the number of cached entries to capacity" do
        cache = described_class.new(capacity: 2)
        cache.fetch("a", "s") { 1 }
        cache.fetch("b", "s") { 2 }
        cache.fetch("c", "s") { 3 }

        # Only the two most-recently-used entries survive; the evicted one is
        # recomputed on the next fetch.
        expect(cache.fetch("b", "s") { 20 }).to eq(2)
        expect(cache.fetch("c", "s") { 30 }).to eq(3)
      end

      it "drops the computed value when an invalidation fires inside the block" do
        calls = 0
        first = subject.fetch("k", "s") do
          calls += 1
          subject.invalidate_account(1)
          :stale
        end

        # The value is returned to the caller, but the invalidation means it is
        # not stored: the next fetch recomputes.
        expect(first).to eq(:stale)
        expect(subject.fetch("k", "s") { calls += 1; :fresh }).to eq(:fresh)
        expect(calls).to eq(2)
      end

      it "still caches when no invalidation fires inside the block" do
        calls = 0
        subject.fetch("k", "s") { calls += 1; :value }

        expect(subject.fetch("k", "s") { calls += 1; :other }).to eq(:value)
        expect(calls).to eq(1)
      end
    end

    context "when disabled" do
      let(:config) { { enabled: false } }

      it "does not cache (always recomputes)" do
        calls = 0
        2.times { subject.fetch("k", "s") { calls += 1; :value } }

        expect(calls).to eq(2)
      end

      it "is unaffected by an invalidation fired inside the block" do
        calls = 0
        2.times do
          subject.fetch("k", "s") { calls += 1; subject.invalidate_account(1); :value }
        end

        expect(calls).to eq(2)
      end

      it "still deep-freezes the returned value so mutation bugs surface in specs" do
        membership = ProjectMembership::Lookup::Membership.new(project_id: "p1", role: "reviewer", organization_id: 7)

        cached = subject.fetch("k", "s") { [membership] }

        expect(cached).to be_frozen
        expect(cached.first).to be_frozen
        expect { cached.first.project_id = "p2" }.to raise_error(FrozenError)
      end
    end
  end

  describe "invalidation" do
    it "invalidate_account clears only the account's memberships" do
      subject.fetch(ProjectMembership::Cache::MEMBERSHIPS_KEY, "1") { [:m] }
      subject.fetch(ProjectMembership::Cache::MEMBERSHIPS_KEY, "2") { [:m] }

      subject.invalidate_account(1)

      expect(subject.fetch(ProjectMembership::Cache::MEMBERSHIPS_KEY, "1") { :recomputed }).to eq(:recomputed)
      expect(subject.fetch(ProjectMembership::Cache::MEMBERSHIPS_KEY, "2") { :kept }).to eq([:m])
    end

    it "invalidate_project clears the project's member-account ids and the org's project ids" do
      subject.fetch(ProjectMembership::Cache::MEMBER_ACCOUNT_IDS_PROJECT_KEY, "p1") { [1] }
      subject.fetch(ProjectMembership::Cache::PROJECT_IDS_ORG_KEY, "7") { ["p1"] }

      subject.invalidate_project("p1", organization_id: 7)

      expect(subject.fetch(ProjectMembership::Cache::MEMBER_ACCOUNT_IDS_PROJECT_KEY, "p1") { :x }).to eq(:x)
      expect(subject.fetch(ProjectMembership::Cache::PROJECT_IDS_ORG_KEY, "7") { :y }).to eq(:y)
    end

    it "invalidate_organization clears the org's member-account ids and project ids" do
      subject.fetch(ProjectMembership::Cache::MEMBER_ACCOUNT_IDS_ORG_KEY, "7") { [1] }
      subject.fetch(ProjectMembership::Cache::PROJECT_IDS_ORG_KEY, "7") { ["p1"] }

      subject.invalidate_organization(7)

      expect(subject.fetch(ProjectMembership::Cache::MEMBER_ACCOUNT_IDS_ORG_KEY, "7") { :x }).to eq(:x)
      expect(subject.fetch(ProjectMembership::Cache::PROJECT_IDS_ORG_KEY, "7") { :y }).to eq(:y)
    end

    it "flush! clears every key family" do
      subject.fetch(ProjectMembership::Cache::MEMBERSHIPS_KEY, "1") { [:m] }
      subject.fetch(ProjectMembership::Cache::MEMBER_ACCOUNT_IDS_PROJECT_KEY, "p1") { [1] }
      subject.fetch(ProjectMembership::Cache::MEMBER_ACCOUNT_IDS_ORG_KEY, "7") { [1] }
      subject.fetch(ProjectMembership::Cache::PROJECT_IDS_ORG_KEY, "7") { ["p1"] }

      subject.flush!

      expect(subject.fetch(ProjectMembership::Cache::MEMBERSHIPS_KEY, "1") { :a }).to eq(:a)
      expect(subject.fetch(ProjectMembership::Cache::MEMBER_ACCOUNT_IDS_PROJECT_KEY, "p1") { :b }).to eq(:b)
      expect(subject.fetch(ProjectMembership::Cache::MEMBER_ACCOUNT_IDS_ORG_KEY, "7") { :c }).to eq(:c)
      expect(subject.fetch(ProjectMembership::Cache::PROJECT_IDS_ORG_KEY, "7") { :d }).to eq(:d)
    end
  end

  describe "singleton" do
    after { described_class.reset! }

    it "returns the same instance across calls" do
      expect(described_class.instance).to be(described_class.instance)
    end

    it "reset! builds a fresh instance" do
      first = described_class.instance
      described_class.reset!
      expect(described_class.instance).not_to be(first)
    end
  end
end
