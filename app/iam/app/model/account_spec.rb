# frozen_string_literal: true

require "spec_helper"

RSpec.describe Account, database: true do
  let(:auth_context) { Verse::Auth::Context.new }

  describe Account::Record do
    let(:account_attributes) do
      {
        id: 1,
        name: "Test User",
        email: "test@example.com",
        hashed_password: BCrypt::Password.create("password123"),
        sso_channel: nil,
        enabled: true,
        role: "user",
        picture_url: nil,
        joined_at: Time.now,
        created_at: Time.now,
        updated_at: Time.now
      }
    end

    subject { described_class.new(account_attributes) }

    describe "#password_match?" do
      context "with correct password" do
        it "returns true" do
          expect(subject.password_match?("password123")).to be true
        end
      end

      context "with incorrect password" do
        it "returns false" do
          expect(subject.password_match?("wrong_password")).to be false
        end
      end

      context "when hashed_password is nil" do
        before do
          account_attributes[:hashed_password] = nil
        end

        it "returns false" do
          expect(subject.password_match?("any_password")).to be false
        end
      end
    end
  end

  describe Account::Repository do
    subject { described_class.new(auth_context) }

    let(:test_email) { "test@example.com" }
    let(:test_password) { "password123" }
    let(:hashed_password) { BCrypt::Password.create(test_password) }

    let!(:account_id) do
      subject.create(
        name: "Test User",
        email: test_email,
        hashed_password:,
        role_name: "user",
        enabled: true
      ).to_i
    end

    it "can be instantiated" do
      expect(subject).to be_a(Account::Repository)
    end

    describe "#login" do
      context "with valid credentials" do
        it "returns the account record" do
          account = subject.login(test_email, test_password)

          expect(account).to be_a(Account::Record)
          expect(account.id).to eq account_id
          expect(account.email).to eq test_email
        end
      end

      context "with invalid email" do
        it "returns nil" do
          account = subject.login("invalid@example.com", test_password)

          expect(account).to be_nil
        end
      end

      context "with invalid password" do
        it "returns nil" do
          account = subject.login(test_email, "wrong_password")

          expect(account).to be_nil
        end
      end

      context "when account does not exist" do
        it "returns nil" do
          account = subject.login("nonexistent@example.com", test_password)

          expect(account).to be_nil
        end
      end
    end

    describe "#scoped as org_owner (accounts_from_project_member_scoped)" do
      let(:org_owner_context) do
        Verse::Auth::Context.new(
          ["iam:accounts.read.as_org_owner"],
          role: "org_owner",
          custom_scopes: { org: ["1"] },
          metadata: { id: 2, email: "owner@test.com", name: "Owner", role: :org_owner }
        )
      end
      let(:org_owner_repo) { described_class.new(org_owner_context) }

      before do
        @actor = subject.create(name: "Actor", email: "actor@test.com", role_name: "org_owner", enabled: true)
        @member = subject.create(name: "Member", email: "member@test.com", role_name: "user", enabled: true)
        @other = subject.create(name: "Other", email: "other@test.com", role_name: "user", enabled: true)

        # The org_owner read scope resolves co-members via the dataset service,
        # through ProjectMembership::Lookup.
        @lookup = double(ProjectMembership::Lookup)
        allow(ProjectMembership::Lookup).to receive(:new).and_return(@lookup)
        allow(@lookup).to receive(:member_account_ids).with(
          organization_ids: ["1"]
        ).and_return(
          [@actor.to_i, @member.to_i, @other.to_i]
        )
        allow(@lookup).to receive(:memberships_for).with(2).and_return([])
      end

      it "returns self plus the co-members of the actor's org projects" do
        result = org_owner_repo.index({})

        expect(result.map(&:id)).to include(@member.to_i, @other.to_i, @actor.to_i)
      end

      it "also returns co-members of the actor's own memberships (foreign projects)" do
        @foreign_member = subject.create(name: "Foreign", email: "foreign@test.com", role_name: "user", enabled: true)

        allow(@lookup).to receive(:memberships_for).with(2).and_return(
          [double(project_id: "p9", role: "reviewer", organization_id: 999)]
        )
        allow(@lookup).to receive(:member_account_ids).with(project_ids: ["p9"]).and_return([@foreign_member.to_i])

        result = org_owner_repo.index({})

        expect(result.map(&:id)).to include(@foreign_member.to_i)
      end
    end
  end
end
