# Testing

## Framework
RSpec for Ruby services. SimpleCov for coverage.

## Test Setup (spec_helper.rb)
```ruby
ENV["APP_ENVIRONMENT"] = "test"
require "webmock"
WebMock.enable!
WebMock.disable_net_connect!
require "simplecov"
require "verse/spec"
require "verse/http/spec"
require "verse/sequel/spec"
require_relative "../config/boot"
Verse.start(:test)
```

Key aspects:
- WebMock blocks external HTTP — stub inter-service API calls
- Event mode: :immediate (synchronous, no Redis)
- SimpleCov groups: Exposition, Model, Service
- Rack::Test::Methods for HTTP endpoint testing
- Verse::Spec for auth context helpers

## Test Fixtures
- Test data in `app/{service}/app/spec_data/`
- Verse::Spec.add_user(:role, "rolename", user_data:, scopes:) for auth contexts

Example:
```ruby
Verse::Spec.add_user(:admin, "admin", user_data: { id: 1, email: "admin@test.com" })
Verse::Spec.add_user(:org_owner, "org_owner",
  user_data: { id: 2, email: "owner@test.com" },
  scopes: { org: ["org-123"] })
```

Used in tests via `as(:admin)` or `as(:org_owner)`.

## Coverage
- Checked via `common/bin/check-coverage`
- Per-service SimpleCov configuration

## Writing Tests

### Expo Tests
```ruby
RSpec.describe AccountsExpo, type: :expo do
  include Rack::Test::Methods

  let(:app) { Verse::Http::Rack::App }

  context "as admin" do
    before { as(:admin) }

    it "lists accounts" do
      get "/accounts"
      expect(last_response.status).to eq(200)
      expect(JSON.parse(last_response.body)["data"]).to be_an(Array)
    end
  end
end
```

### Service Tests
```ruby
RSpec.describe Account::Service do
  subject { described_class.new }

  it "returns account" do
    as(:admin)
    account = subject.show(1)
    expect(account).to be_a(Account::Record)
  end
end
```

### Stubbing API Calls
```ruby
stub_request(:get, /iam/).to_return(
  status: 200,
  body: { data: [{ id: "1", type: "iam:accounts", attributes: { email: "test@test.com" } }] }.to_json,
  headers: { "Content-Type" => "application/vnd.api+json" }
)
```

## Config
- `config.test.yml` overrides: event adapter = local, log level = debug
- No external dependencies (Redis, SMTP, S3) required in tests
