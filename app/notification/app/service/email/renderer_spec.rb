# frozen_string_literal: true

require "spec_helper"

RSpec.describe Email::Renderer do
  let(:account) { double(name: "Test User", email: "test@example.com") }
  let(:notification) do
    double(
      category: "project_member_added",
      title: "Assigned to '<script>alert(1)</script>'",
      project_name: "<script>alert(1)</script>",
      project_id: 1,
      inviter_name: "Inviter User"
    )
  end

  subject { described_class.new(account, notification) }

  describe "#render_html" do
    it "HTML-escapes user-controlled values to prevent stored XSS" do
      html = subject.render_html

      expect(html).to include("&lt;script&gt;")
      expect(html).not_to include("<script>alert(1)</script>")
    end
  end

  describe "#render_text" do
    it "does not HTML-escape the plain-text part" do
      expect(subject.render_text).to include("<script>alert(1)</script>")
    end
  end
end
