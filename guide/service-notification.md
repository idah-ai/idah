# Notification Service

## Overview

The Notification Service handles **email delivery** for all transactional notifications across IDAH. It is **purely event-driven** — it has no HTTP endpoints and no database tables. It subscribes to a single custom event channel and routes email requests through template rendering and SMTP delivery.

All other services send email requests by publishing to the shared `notification:email` channel using a helper from `common/lib/service/notification.rb`.

---

## Architecture

```
Any Service                          Notification Service
───────────                          ────────────────────
Service::Notification.email(         → Subscribes to channel
  title: "Welcome",                    → Email::Service#send_email
  category: "account_created",           → Lookup account (API: IAM)
  type: "invitation",                    → Check preferences (API: Setting)
  to: "user@example.com",                → Build Mail object
  **params                               → Render HTML + text templates
)                                      → Deliver via SMTP (MailHog in dev)
  → Publishes to
    "notification:email"
```

The service uses the `common/lib/service/notification.rb` helper on the publishing side and the `Service::Notification::SEND_EMAIL_CHANNEL` constant for channel coordination.

---

## Event Channel

| Constant | Channel String | Payload |
|----------|---------------|---------|
| `Service::Notification::SEND_EMAIL_CHANNEL` | `notification:email` | `{ title:, category:, type:, to:, **params }` |

The channel constant is defined in `common/lib/service/notification.rb`:

```ruby
module Service
  module Notification
    SEND_EMAIL_CHANNEL = "notification:email"

    def self.email(title:, category:, type:, to:, **params)
      Verse::Event::Bus.publish(
        SEND_EMAIL_CHANNEL,
        { title:, category:, type:, to:, **params }
      )
    end
  end
end
```

Any service can send an email by calling this helper:

```ruby
Service::Notification.email(
  title: "You've been added to a project",
  category: "project_member_added",
  type: "notification",
  to: account.email,
  project_name: project.name,
  organization_name: organization.name
)
```

---

## Endpoints

The Notification Service exposes **no HTTP endpoints**. All interaction is through event subscription.

---

## Key Services

### Email::Service

The core service that receives email events and orchestrates delivery.

```ruby
class Email::Service < Verse::Service::Base
  def send_email(notify)
    # 1. Lookup the recipient account
    account = lookup_account(notify.to)

    # 2. Check notification preferences
    return unless wants_notification?(account, notify.category)

    # 3. Build and render the email
    mail = build_mail(account, notify)

    # 4. Deliver
    mail.deliver
  end

  private

  def lookup_account(email)
    response = Api[:idah].iam.accounts.index(email:)
    raise Verse::Error::RecordNotFound, "Account not found: #{email}" if response.data.empty?
    response.data.first
  end

  def wants_notification?(account, category)
    response = Api[:idah].setting.account_settings.index(
      account_id: account.id,
      key: "notification_#{category}"
    )
    # Default to true if no preference is set
    setting = response.data.first
    setting.nil? || setting.value == "true"
  end

  def build_mail(account, notify)
    Mail.new do
      from    "noreply@ingedata.com"
      to      account.email
      subject notify.title

      html_part do
        content_type "text/html; charset=UTF-8"
        body Email::Renderer.render(account:, notify:)
      end

      text_part do
        content_type "text/plain; charset=UTF-8"
        body Email::Renderer.render_plain(account:, notify:)
      end
    end
  end
end
```

#### Steps in Detail

**Step 1: Account Lookup**

Uses the inter-service API client (`Api[:idah]`) to fetch the recipient's account record from the IAM Service. The email address from the event payload is used as the lookup key.

**Step 2: Preference Check**

Queries the Setting Service for the account's notification preference for the given category. Preferences are stored as `AccountSetting` records with keys like `notification_account_created`, `notification_project_member_added`, etc. If no preference is found, the service defaults to `true` (send the notification).

**Step 3: Mail Construction**

Builds a `Mail::Message` (via the `mail` gem) with:

- **From**: Always `noreply@ingedata.com` (configurable via environment)
- **To**: The recipient's email from the account lookup
- **Subject**: The `title` field from the event payload
- **HTML body**: Rendered via `Email::Renderer`
- **Text body**: Plain-text fallback rendered via `Email::Renderer`

**Step 4: Delivery**

Uses SMTP configuration from the service's config (MailHog in development, SMTP relay in production).

### Email::Renderer

ERB-based template renderer for email content.

```ruby
class Email::Renderer
  TEMPLATE_DIR = File.expand_path("../../views/emails", __dir__)

  def self.render(account:, notify:)
    template = resolve_template(notify.category)
    content = render_template(template, account:, notify:)
    wrap_in_layout(content)
  end

  def self.render_plain(account:, notify:)
    template = resolve_plain_template(notify.category)
    content = render_template(template, account:, notify:)
    # No layout wrapping for plain text
    content
  end

  private

  def self.resolve_template(category)
    # Try category-specific template first, fall back to "default"
    specific = File.join(TEMPLATE_DIR, "#{category}.html.erb")
    default  = File.join(TEMPLATE_DIR, "default.html.erb")
    File.exist?(specific) ? specific : default
  end

  def self.resolve_plain_template(category)
    specific = File.join(TEMPLATE_DIR, "#{category}.text.erb")
    default  = File.join(TEMPLATE_DIR, "default.text.erb")
    File.exist?(specific) ? specific : default
  end

  def self.render_template(path, account:, notify:)
    template = File.read(path)
    ERB.new(template).result_with_hash(
      account:,
      title: notify.title,
      params: notify.to_h
    )
  end

  def self.wrap_in_layout(content)
    header = File.read(File.join(TEMPLATE_DIR, "_header.html.erb"))
    footer = File.read(File.join(TEMPLATE_DIR, "_footer.html.erb"))
    layout = File.read(File.join(TEMPLATE_DIR, "_layout.html.erb"))
    body = ERB.new(header).result + content + ERB.new(footer).result
    ERB.new(layout).result_with_hash(body:)
  end
end
```

The renderer wraps all category-specific content in shared header/footer partials, ensuring brand consistency across all emails.

---

## Template Categories

| Category | Purpose | Parameters |
|----------|---------|------------|
| `account_created` | Account invitation email | `account`, `invitation_token`, `organization_name` |
| `password_reset` | Password reset link | `account`, `reset_token` |
| `project_member_added` | User added to a project | `account`, `project_name`, `organization_name`, `added_by_name` |
| `project_member_removed` | User removed from a project | `account`, `project_name`, `organization_name` |
| `org_owner_role_assigned` | User promoted to org owner | `account`, `organization_name` |
| `org_owner_role_removed` | User demoted from org owner | `account`, `organization_name` |
| `dataset_completed` | Dataset annotation completed | `account`, `dataset_name`, `project_name` |

### Template Resolution

```
views/emails/
├── _header.html.erb        ← Shared header partial
├── _footer.html.erb        ← Shared footer partial
├── _layout.html.erb        ← Outer layout wrapping header + content + footer
├── default.html.erb        ← Fallback HTML template
├── default.text.erb        ← Fallback plain text template
├── account_created.html.erb
├── account_created.text.erb
├── password_reset.html.erb
├── password_reset.text.erb
├── project_member_added.html.erb
├── project_member_added.text.erb
├── project_member_removed.html.erb
├── project_member_removed.text.erb
├── org_owner_role_assigned.html.erb
├── org_owner_role_assigned.text.erb
├── org_owner_role_removed.html.erb
├── org_owner_role_removed.text.erb
└── dataset_completed.html.erb
    dataset_completed.text.erb
```

If a category-specific template is missing, the renderer falls back to `default.html.erb` / `default.text.erb`, which renders a generic message using the available parameters.

---

## Event Handler

The single event subscription that drives the entire service:

```ruby
class EmailsExpo < BaseExpo
  expose on_event(Service::Notification::SEND_EMAIL_CHANNEL)
  def on_send_email
    notify = Verse::JsonApi::Struct.new(message.content)
    service.send_email(notify)
  end
end
```

```ruby
# config/routes.rb
Verse.on_boot do
  [EmailsExpo].each(&:register)
end
```

---

## Configuration

The service reads SMTP settings from its config files:

```yaml
# config/config.yml
smtp:
  address: localhost
  port: 1025            # MailHog default for development

# config/config.production.yml
smtp:
  address: smtp.sendgrid.net
  port: 587
  domain: ingedata.com
  user_name: <%= ENV["SMTP_USERNAME"] %>
  password: <%= ENV["SMTP_PASSWORD"] %>
  authentication: plain
  enable_starttls_auto: true
```

The `from` address for all outgoing emails is configurable:

```yaml
email:
  from: noreply@ingedata.com
```

In development, the service uses **MailHog** (ports 1025 SMTP / 8025 web UI) to capture all outgoing emails. No emails are actually delivered to real recipients during development.

---

## Related Documentation

| Topic | Guide |
|-------|-------|
| Event system (publish/subscribe) | [`guide/event-system.md`](guide/event-system.md) |
| Verse layered architecture | [`guide/verse-architecture.md`](guide/verse-architecture.md) |
| Exposition layer (HTTP + events) | [`guide/exposition-layer.md`](guide/exposition-layer.md) |
| Service layer (business logic) | [`guide/service-layer.md`](guide/service-layer.md) |
| Inter-service API client | [`guide/inter-service-api.md`](guide/inter-service-api.md) |
| Setting Service (account preferences) | [`guide/service-setting.md`](guide/service-setting.md) |
| IAM Service (account lookup) | [`guide/service-iam.md`](guide/service-iam.md) |
