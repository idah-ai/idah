# frozen_string_literal: true

require "spec_helper"

RSpec.describe Email::Service, database: true do
  let(:auth_context) { Verse::Auth::Context.new }

  subject { described_class.new(auth_context) }

  let(:to_email) { "test@example.com" }
  let(:account) do
    double(
      id: 1,
      email: to_email,
      name: "Test User"
    )
  end

  let(:notification) do
    double(
      title: "Test Notification",
      category: "project_member_added",
      type: "notification:project:activities",
      project_id: 1,
      project_name: "Test Project",
      inviter_email: "inviter@example.com",
      inviter_name: "Inviter User"
    )
  end

  before do
    # Mock the IAM API call
    allow(Api[:idah].iam.accounts).to receive(:index).and_return(
      double(data: [account])
    )

    # Mock the Account Settings API call
    allow(Api[:idah].setting.account_settings).to receive(:index).and_return(
      double(
        data: [
          double(key: "notification:project:activities", value: true),
          double(key: "notification:organization:activities", value: true)
        ]
      )
    )

    # Mock the Mail delivery
    allow(Mail).to receive(:deliver)
  end

  describe "#send_email" do
    it "sends an email to the specified recipient" do
      subject.send_email(to_email, notification)

      expect(Mail).to have_received(:deliver)
    end

    it "retrieves the account from IAM service" do
      subject.send_email(to_email, notification)

      expect(Api[:idah].iam.accounts).to have_received(:index).with(
        hash_including(
          filter: { email: to_email }
        )
      )
    end

    context "when account is not found" do
      before do
        allow(Api[:idah].iam.accounts).to receive(:index).and_return(
          double(data: [])
        )
      end

      it "raises NotFound error" do
        expect {
          subject.send_email(to_email, notification)
        }.to raise_error(Verse::Error::NotFound, "Account not found for email: #{to_email}")
      end

      it "does not send email" do
        expect {
          subject.send_email(to_email, notification)
        }.to raise_error(Verse::Error::NotFound)

        expect(Mail).not_to have_received(:deliver)
      end
    end

    context "when notification type is disabled" do
      context "for notification:project:activities" do
        before do
          allow(Api[:idah].setting.account_settings).to receive(:index).and_return(
            double(
              data: [
                double(key: "notification:project:activities", value: false),
                double(key: "notification:organization:activities", value: true)
              ]
            )
          )
        end

        it "does not send email" do
          subject.send_email(to_email, notification)

          expect(Mail).not_to have_received(:deliver)
        end
      end

      context "for notification:organization:activities" do
        let(:notification) do
          double(
            title: "Organization Notification",
            category: "organization_member_added",
            type: "notification:organization:activities",
            organization_id: 1,
            organization_name: "Test Organization",
            inviter_email: "inviter@example.com",
            inviter_name: "Inviter User"
          )
        end

        before do
          allow(Api[:idah].setting.account_settings).to receive(:index).and_return(
            double(
              data: [
                double(key: "notification:project:activities", value: true),
                double(key: "notification:organization:activities", value: false)
              ]
            )
          )
        end

        it "does not send email" do
          subject.send_email(to_email, notification)

          expect(Mail).not_to have_received(:deliver)
        end
      end
    end

    context "with different notification categories" do
      it "handles project_member_added notifications" do
        notification = double(
          title: "Added to project",
          category: "project_member_added",
          type: "notification:project:activities",
          project_name: "Project X",
          project_id: 2,
          inviter_email: "inviter@example.com",
          inviter_name: "Inviter User"
        )

        subject.send_email(to_email, notification)

        expect(Mail).to have_received(:deliver)
      end

      it "handles project_member_removed notifications" do
        notification = double(
          title: "Removed from project",
          category: "project_member_removed",
          type: "notification:project:activities",
          project_name: "Project X",
          remover_email: "remover@example.com",
          remover_name: "Remover User"
        )

        subject.send_email(to_email, notification)

        expect(Mail).to have_received(:deliver)
      end

      it "handles account_created notifications" do
        notification = double(
          title: "Account created",
          category: "account_created",
          type: "notification:account:activities",
          password_reset_token: "some_token",
          recipient_account_id: account.id,
        )

        subject.send_email(to_email, notification)

        expect(Mail).to have_received(:deliver)
      end

      it "raise error for unknown notification category" do
        notification = double(
          title: "Unknown notification",
          category: "unknown_category",
          type: "notification:unknown_category"
        )

        expect {
          subject.send_email(to_email, notification)
        }.to raise_error(StandardError, "No template found for unknown_category")
      end
    end
  end
end
