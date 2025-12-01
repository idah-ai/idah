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
  end
end
