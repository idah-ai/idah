# frozen_string_literal: true

require "spec_helper"

RSpec.describe AccountPassword::Service, database: true do
  let(:auth_context) { Verse::Auth::Context.new }

  subject { described_class.new(auth_context) }

  let(:account_repo) { Account::Repository.new(auth_context) }

  let(:account_attributes) do
    {
      name: "Test User",
      email: "test@example.com",
      enabled: true,
      hashed_password: BCrypt::Password.create("OldPassword123!")
    }
  end

  before do
    # Freeze the time
    allow(Time).to receive(:now).and_return(
      Time.utc(2025, 1, 1, 12, 0, 0)
    )
  end

  describe "#request_password_reset" do
    context "when account exists" do
      it "generates a password reset token and sends an email" do
        account_id = account_repo.create(account_attributes)

        expect(::Service::Notification).to receive(:email).with(
          recipient_account_email: "test@example.com",
          title: "Reset Password",
          category: "password_reset",
          password_reset_token: instance_of(String)
        )

        subject.request_password_reset("test@example.com")

        account = account_repo.find!(account_id)
        expect(account.password_reset_token).to be_a(String)
        expect(account.password_reset_token_expires_at).to eq(Time.now + 3600)
      end
    end

    context "when account does not exist" do
      it "does not raise an error and does not send an email" do
        expect(::Service::Notification).not_to receive(:email)

        expect {
          subject.request_password_reset("nonexistent@example.com")
        }.to raise_error(Verse::Error::NotFound, "account not found")
      end
    end
  end

  describe "#reset_password" do
    let(:reset_token) { SecureRandom.hex(32) }
    let(:new_password) { "NewSecureP@ss123" }

    context "when token is valid and not expired" do
      it "resets the password and clears the reset token" do
        account_attributes.merge!(
          password_reset_token: reset_token,
          password_reset_token_expires_at: Time.now + 1800
        )

        account_id = account_repo.create(account_attributes)

        subject.reset_password(reset_token, new_password)

        account = account_repo.find!(account_id)
        expect(account.password_reset_token).to be_nil
        expect(account.password_reset_token_expires_at).to be_nil
        expect(BCrypt::Password.new(account.hashed_password)).to eq(new_password)
      end
    end

    context "when token does not exist" do
      it "raises NotFound error" do
        expect {
          subject.reset_password("invalid_token", new_password)
        }.to raise_error(Verse::Error::NotFound, "Invalid password reset token")
      end
    end

    context "when token has expired" do
      it "raises ValidationFailed error" do
        account_attributes.merge!(
          password_reset_token: reset_token,
          password_reset_token_expires_at: Time.now - 100
        )

        account_repo.create(account_attributes)

        expect {
          subject.reset_password(reset_token, new_password)
        }.to raise_error(Verse::Error::ValidationFailed, "Password reset token expired")
      end
    end

    context "when token expiration time is nil" do
      it "raises ValidationFailed error" do
        account_attributes.merge!(
          password_reset_token: reset_token,
          password_reset_token_expires_at: nil
        )

        account_repo.create(account_attributes)

        expect {
          subject.reset_password(reset_token, new_password)
        }.to raise_error(Verse::Error::ValidationFailed, "Password reset token expired")
      end
    end
  end

  describe "#token_valid?" do
    let(:reset_token) { SecureRandom.hex(32) }

    context "when token exists and is not expired" do
      it "returns true" do
        account_attributes.merge!(
          password_reset_token: reset_token,
          password_reset_token_expires_at: Time.now + 1800
        )

        account_repo.create(account_attributes)

        expect(subject.token_valid?(reset_token)).to eq(true)
      end
    end

    context "when token does not exist" do
      it "returns false" do
        expect(subject.token_valid?("nonexistent_token")).to eq(false)
      end
    end

    context "when token has expired" do
      it "returns false" do
        account_attributes.merge!(
          password_reset_token: reset_token,
          password_reset_token_expires_at: Time.now - 100
        )

        account_repo.create(account_attributes)

        expect(subject.token_valid?(reset_token)).to eq(false)
      end
    end

    context "when token expiration time is nil" do
      it "returns false" do
        account_attributes.merge!(
          password_reset_token: reset_token,
          password_reset_token_expires_at: nil
        )

        account_repo.create(account_attributes)

        expect(subject.token_valid?(reset_token)).to eq(false)
      end
    end

    context "when token expiration time is exactly now" do
      it "returns false" do
        account_attributes.merge!(
          password_reset_token: reset_token,
          password_reset_token_expires_at: Time.now
        )

        account_repo.create(account_attributes)

        expect(subject.token_valid?(reset_token)).to eq(false)
      end
    end
  end

  describe "#change_password" do
    let(:old_password) { "OldPassword123!" }
    let(:new_password) { "NewSecureP@ss123" }

    it "changes the password when old password is correct" do
      account_id = account_repo.create(account_attributes)

      subject.change_password(account_id, old_password, new_password)

      account = account_repo.find!(account_id)
      expect(BCrypt::Password.new(account.hashed_password)).to eq(new_password)
    end

    it "raises ValidationFailed error when old password is incorrect" do
      account_id = account_repo.create(account_attributes)

      expect {
        subject.change_password(account_id, "WrongOldPassword!", new_password)
      }.to raise_error(Verse::Error::ValidationFailed, "Old password is incorrect")
    end
  end
end
