# frozen_string_literal: true

require "spec_helper"

RSpec.describe EmailsExpo, type: :exposition, as: :system do
  describe "#on_send_email" do
    let(:message_content) do
      {
        account_email: "test@example.com",
        title: "Test Notification",
        category: "project_member_added",
        project_id: 1,
        project_name: "Test Project",
        inviter_email: "inviter@example.com"
      }
    end


    it "sends an email notification" do
      expect_any_instance_of(
        Email::Service
      ).to receive(
        :send_email
      ).with(
        "test@example.com",
        Verse::JsonApi::Struct.new(message_content)
      )

      Verse.publish("notification:email", message_content)
    end

    it "raise error when missing account_email" do
      invalid_content = message_content.reject { |k, _| k == :account_email }

      expect {
        Verse.publish("notification:email", invalid_content)
      }.to raise_error(Verse::Error::ValidationFailed, "Missing account_email in email content")
    end
  end
end
