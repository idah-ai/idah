# Audit Report — `common/` Shared Library

**Scope:** `idah/common/lib/**` (all `.rb` files), `idah/common/Gemfile`, `idah/common/.rubocop.yml`
**Date:** 2026-06-18
**Auditor:** Automated code audit
**Framework context:** Verse (non-Rails), Sequel, Zeitwerk, Puma, Redis pub/sub

---

## Executive Summary

The `common/` library is the foundation shared by every Ruby service in IDAH. It is generally well-structured and follows the Verse conventions described in the project guides. However, the audit surfaced **several high-impact security and reliability issues** that should be addressed before any further production hardening:

1. **TLS verification is disabled** for all inter-service HTTPS calls (`OpenSSL::SSL::VERIFY_NONE`), enabling trivial MitM inside the cluster.
2. **No HTTP timeouts** are configured on the inter-service `Net::HTTP` client — a single unresponsive service can exhaust the worker pool and take down callers.
3. **JWT signature is never verified** when caching the inter-service bearer token — the `exp` claim is parsed from an untrusted, unverified payload.
4. **Service credentials are sent over the same client** that disables TLS verification, compounding the exposure.
5. **`ThreadPool#stop` is not idempotent** and **`worker_loop` swallows `ClosedQueueError`** in a way that can drop tasks; the pool also has no `MonitorMixin`-protected condition variable despite the AGENTS.md mandate.
6. **`PluginSystem.restart_plugin` is referenced but not defined** on the `PluginSystem` module — the restart event handler will raise `NoMethodError` at runtime.
7. **`RoleBackend` is constructed with a fresh empty `Verse::Auth::Context`**, which silently bypasses auth scoping for every role lookup; combined with `RoleRepository#load` instantiating its own context, the auth boundary for the role catalog is effectively unenforced.
8. **`UUIDv7` provides no uniqueness guarantee** — it relies entirely on `SecureRandom.gen_random` with no monotonic counter, so two calls within the same millisecond can collide (~74 bits of entropy per ms, but no de-duplication). Acceptable for low-volume use, risky for high-throughput inserts relying on PK uniqueness.
9. **`YAML.safe_load` is used without an explicit permitted-classes list** in `RoleRepository`, which is safe today but fragile.
10. **Dead/duplicated code** in `dataset.rb` API map (`entries.index_all` is registered twice) and a `require "pry"` shipped in production code.

None of these are fixed by this report — findings only.

---

## Findings Index

| ID | Severity | Category | File:Line | Title |
|----|----------|----------|-----------|-------|
| F-001 | **Critical** | Security | `lib/api/exposition.rb:76` | TLS certificate verification disabled for HTTPS |
| F-002 | **Critical** | Security | `lib/api/__map__/__include__.rb:40-41` | JWT signature not verified before parsing claims |
| F-003 | **High** | Security | `lib/api/exposition.rb:70-78` | No HTTP open/read/write timeouts on inter-service client |
| F-004 | **High** | Security | `lib/api/__map__/__include__.rb:22-43` | Cached token state mutated without synchronization |
| F-005 | **High** | Architecture | `lib/role_backend.rb:9` | `RoleBackend` bypasses auth context scoping |
| F-006 | **High** | CodeSmell | `lib/plugin_system/exposition.rb:7` | `PluginSystem.restart_plugin` is undefined → runtime `NoMethodError` |
| F-007 | **High** | ThreadSafety | `lib/thread_pool.rb:23-26, 30-53` | `ThreadPool#stop` not idempotent; tasks can be silently dropped |
| F-008 | **High** | Security | `lib/api/exposition.rb:80-82` | Error responses not surfaced — body discarded, status only |
| F-009 | **Medium** | Security | `lib/role_repository.rb:18, 29` | `YAML.safe_load` without explicit permitted classes |
| F-010 | **Medium** | CodeSmell | `lib/uuid_v7.rb` / `lib/uuid_v7/generator.rb` | No monotonic counter; sub-ms collision possible |
| F-011 | **Medium** | Performance | `lib/api.rb:16-36` | `Api.all` re-allocates `params[:page]` hash on every page iteration |
| F-012 | **Medium** | CodeSmell | `lib/api/__map__/dataset.rb:80-122` | Duplicate `entries.index_all` registration (overwrites earlier) |
| F-013 | **Medium** | CodeSmell | `lib/api/exposition.rb:7` | `require "pry"` shipped in production code |
| F-014 | **Medium** | CodeSmell | `lib/healthcheck_service.rb:15-39` | `lazy.select{}.each` defeats laziness and swallows exception detail |
| F-015 | **Medium** | CodeSmell | `lib/healthcheck_service.rb:46-52` | `rescue RuntimeError` references `status` that may be uninitialized |
| F-016 | **Medium** | ThreadSafety | `lib/plugin_system.rb:8, 16-36` | `PluginSystem` module-level mutable state without synchronization |
| F-017 | **Medium** | Architecture | `lib/plugin_system/registry.rb:24` | `retrieve_plugin(name, version)` — `version` is undefined variable |
| F-018 | **Medium** | CodeSmell | `lib/plugin_system/plugin.rb:80-85` | `Plugin#reload` calls `start` without required `context_class` arg |
| F-019 | **Medium** | CodeSmell | `lib/role_backend.rb:39-44` | Compound-role dedup logic reverses semantics ambiguously |
| F-020 | **Low** | CodeSmell | `lib/api/exposition.rb:174` | `SecureRandom` referenced but never required in this file |
| F-021 | **Low** | CodeSmell | `lib/role_backend.rb:26-45` | `compound_role` overwrites `rights` variable, dead assignment |
| F-022 | **Low** | CodeSmell | `lib/api/exposition.rb:107-119` | `build_uri` accepts unused `_headers` parameter |
| F-023 | **Low** | CodeSmell | `lib/semantic_version.rb` | Does not support pre-release / build metadata; not strictly SemVer 2.0 |
| F-024 | **Low** | CodeSmell | `lib/migration/timestamps.rb:12` | Regex-based updated_at detection is brittle |
| F-025 | **Low** | Performance | `lib/expo/util/duplicate_field_helper.rb:33-35` | N+1 update loop on resource event |
| F-026 | **Low** | CodeSmell | `lib/api/service.rb:23-29` | `Service#path` defined but never called |
| F-027 | **Info** | Architecture | `lib/api.rb:71-73` | `Dir.glob` eager-require at file load bypasses Zeitwerk |
| F-028 | **Info** | CodeSmell | `lib/api/exposition.rb:46-85` | `execute_request` ~40 lines, multiple responsibilities |
| F-029 | **Info** | CodeSmell | `Gemfile:7-11` | All verse gems pinned to `master`/feature branches |
| F-030 | **Info** | CodeSmell | `.rubocop.yml:6-7` | RuboCop excludes `common/**/*` from enforcement |

---

## Detailed Findings

### F-001 — TLS certificate verification disabled for HTTPS  🔴 Critical / Security

**File:** `idah/common/lib/api/exposition.rb:74-76`

**Description:** Every inter-service HTTPS request explicitly sets `http.verify_mode = OpenSSL::SSL::VERIFY_NONE`. The inline comment acknowledges this is wrong but ships it anyway.

**Impact:** Any party able to intercept traffic inside the cluster (compromised pod, malicious sidecar, ARP/DNS spoofing) can impersonate any service. Because the same client carries **service-account credentials** (see `__include__.rb`) and **bearer JWTs**, an attacker can harvest a valid service token and pivot.

**Evidence:**
```ruby
http.verify_mode = OpenSSL::SSL::VERIFY_NONE if use_ssl
```

**Recommendation:** Use a real CA bundle (e.g., a cluster-internal self-signed CA distributed via a ConfigMap/Secret mounted into the container). Set `http.ca_file = ENV.fetch("IDAH_CA_BUNDLE")` and leave verification on. If TLS is genuinely not used inside the cluster, force `http://` only and remove the `https` branch entirely.

**Effort:** M

---

### F-002 — JWT signature not verified before parsing claims  🔴 Critical / Security

**File:** `idah/common/lib/api/__map__/__include__.rb:40-41`

**Description:** `generate_token` extracts the JWT `exp` claim by base64-decoding the payload directly, with **no signature verification** and **no algorithm pinning**. The decoded value is then trusted to drive token-cache decisions.

**Impact:** A MitM (made trivial by F-001) or a malicious upstream can return a forged token with an arbitrary `exp` (e.g., year 2099) and the client will cache and reuse it indefinitely. Combined with F-001 this is a complete auth bypass primitive.

**Evidence:**
```ruby
token = output.meta&.dig(:token)
@service_token_expires_at = JSON.parse(Base64.decode64(token.split(".")[1]))["exp"] if token
@service_token = token
```

**Recommendation:** Verify the JWT with the IAM service's public key before trusting any claim. Use a vetted library (`jwt` gem) with `algorithm: "RS256"` (or whatever IAM uses) and explicit `verify_aud`/`verify_iat`. Treat unparseable or unverifiable tokens as auth failures.

**Effort:** M

---

### F-003 — No HTTP timeouts on inter-service client  🟠 High / Security

**File:** `idah/common/lib/api/exposition.rb:70-78`

**Description:** `Net::HTTP.new(uri.host, uri.port)` is created without `open_timeout`, `read_timeout`, or `write_timeout`. The default Ruby read timeout is 60 seconds; open timeout is infinite.

**Impact:** A hung upstream service will block the calling Puma thread for up to a minute per request. Because the same client is used inside `Api.all` pagination loops and event handlers, a single degraded dependency can cascade into total service unavailability (thread-pool exhaustion / cascading timeout).

**Evidence:**
```ruby
http = Net::HTTP.new(uri.host, uri.port)
use_ssl = uri.scheme == "https"
http.use_ssl = use_ssl
http.verify_mode = OpenSSL::SSL::VERIFY_NONE if use_ssl
response = http.request(request)
```

**Recommendation:** Set explicit, short timeouts (e.g., `open_timeout: 2`, `read_timeout: 5`, `write_timeout: 5`) configurable via `Verse.config`. Consider `Net::HTTP::Persistent` for connection reuse.

**Effort:** S

---

### F-004 — Cached token state mutated without synchronization  🟠 High / Security

**File:** `idah/common/lib/api/__map__/__include__.rb:22-43`

**Description:** `generate_token` reads and writes `@service_token` and `@service_token_expires_at` without any mutex. The method is invoked from the `:bearer` auth callback, which runs on whatever Puma thread issues an inter-service call.

**Impact:** Under concurrent requests, multiple threads can simultaneously observe a stale token, simultaneously invoke `iam.auth.login`, and overwrite each other's results in a non-atomic way. At best this causes redundant logins (load spikes on IAM); at worst, a partially-written `@service_token_expires_at` can be observed as `nil` and trigger an infinite refresh loop.

**Evidence:**
```ruby
def generate_token
  if @service_token && @service_token_expires_at && (@service_token_expires_at - Time.now.to_i) >= 60
    return @service_token
  end
  # ... login ...
  @service_token_expires_at = JSON.parse(...)
  @service_token = token
  token
end
```

**Recommendation:** Wrap the cache check + refresh in a `MonitorMixin`-protected critical section, or use `Concurrent::ReentrantLock`. Consider a single-flight pattern so only one thread performs the refresh while others wait.

**Effort:** S

---

### F-005 — `RoleBackend` bypasses auth context scoping  🟠 High / Architecture

**File:** `idah/common/lib/role_repository.rb:13` and `idah/common/lib/role_backend.rb:6-10`

**Description:** `RoleBackend#initialize` discards the caller's auth context and substitutes `Verse::Auth::Context.new` (an empty/default context). `RoleRepository.load` similarly instantiates `new(Verse::Auth::Context.new)`. The AGENTS.md golden rules require every repository to implement and respect `scoped(action)`; constructing a repository with a synthetic context defeats this.

**Impact:** Role lookups occur with whatever rights the default context grants, not the caller's. Since `RoleBackend#fetch` is on the authz hot path (it returns the rights list later evaluated by `RoleBackend` consumers), any future scoping logic added to `RoleRepository` will be silently bypassed for the most security-critical reads.

**Evidence:**
```ruby
# role_backend.rb
def initialize(*)
  super(Verse::Auth::Context.new)
end

# role_repository.rb
def self.load
  repo = new(Verse::Auth::Context.new)
  ...
end
```

**Recommendation:** Either (a) make role data explicitly system-level (use `use_system_repo` per the documented exception, with a comment justifying it), or (b) thread the real auth context through. Document the decision in code. The current pattern is the exact "bypass" the AGENTS.md warns against.

**Effort:** M

---

### F-006 — `PluginSystem.restart_plugin` is undefined  🟠 High / CodeSmell

**File:** `idah/common/lib/plugin_system/exposition.rb:5-13`, `idah/common/lib/plugin_system.rb`

**Description:** The plugin-restart event handler calls `PluginSystem.restart_plugin(plugin_name, plugin_version)`. `PluginSystem` is declared as `extend self` (so `init`, `config`, `registry` are callable), but **no `restart_plugin` method is defined** anywhere in `common/`. The guide (`guide/plugin-system.md`) shows the intended implementation, but it was never ported into the library.

**Impact:** Any `setting:plugins:restart_required` event will raise `NoMethodError: undefined method 'restart_plugin' for PluginSystem`. The plugin restart mechanism is dead in production.

**Evidence:**
```ruby
# exposition.rb
def restart_plugin
  PluginSystem.restart_plugin(
    *message.values_at(:plugin_name, :plugin_version)
  )
end
```
```ruby
# plugin_system.rb — no restart_plugin defined
module PluginSystem
  extend self
  attr_reader :config, :registry
  def init(...) ... end
end
```

**Recommendation:** Implement `PluginSystem.restart_plugin(name, version)` on the module (delegate to `@registry`), or remove the exposition if the feature is not yet supported. Add a spec.

**Effort:** S

---

### F-007 — `ThreadPool#stop` not idempotent; tasks can be dropped  🟠 High / ThreadSafety

**File:** `idah/common/lib/thread_pool.rb:23-53`

**Description:** Multiple issues:

1. `stop` calls `@queue.close` then `@workers.each(&:join)`. If `stop` is called twice, the second `@queue.close` raises `ThreadError` (a closed queue cannot be re-closed). There is no `@stopped` guard.
2. In `worker_loop`, the inner `rescue ThreadError, ClosedQueueError` is at the same level as the `begin/rescue StandardError` block — meaning a `ThreadError` raised **inside** `task.call` will be caught by the outer rescue and cause the worker to break out of the loop entirely, killing the worker while the pool is supposedly still running.
3. `@usage` is incremented *after* popping the task but the increment is not paired with a check on `free` capacity — `run` will happily enqueue unbounded work regardless of `@size`. The `free` reader is informational only.
4. `MonitorMixin` is included but `@condition` (`new_cond`) is never used; the AGENTS.md mandates `MonitorMixin` synchronization for the thread pool, but the actual synchronization is partial (only `@usage` is guarded, not the lifecycle).

**Impact:** Calling `stop` twice (e.g., from a signal handler and an `at_exit`) crashes the shutdown path. A task that raises `ThreadError` will silently kill a worker, reducing pool capacity without recovery. The pool provides no backpressure.

**Evidence:**
```ruby
def stop
  @queue.close
  @workers.each(&:join)
end

def worker_loop
  loop do
    break if @queue.closed?
    task = @queue.pop
    next if task.nil?
    begin
      synchronize{ @usage += 1 }
      task.call
    rescue StandardError => e
      ...
    ensure
      synchronize{ @usage -= 1 }
    end
  rescue ThreadError, ClosedQueueError
    break if @queue.closed? || @queue.empty?
  end
end
```

**Recommendation:**
- Add `@stopped = false` guarded by `synchronize`; make `stop` a no-op if already stopped.
- Narrow the inner rescue to wrap only `task.call`, not the queue pop. Move `ClosedQueueError` handling to the outer `@queue.pop` call site.
- Either implement backpressure (block `run` when `@queue.size >= max_pending`) or rename `free` to make clear it is a gauge, not a limit.
- Use `@condition` to broadcast shutdown or remove it.

**Effort:** M

---

### F-008 — HTTP error responses discard body and detail  🟠 High / Security

**File:** `idah/common/lib/api/exposition.rb:80-84`

**Description:** When an upstream returns `>= 400`, the client raises a generic `RuntimeError` containing only the status code and message. The response **body** (which typically carries the JSON:API error detail) is discarded.

**Impact:** Callers cannot distinguish 401 (token expired — should refresh) from 403 (forbidden — should not retry) from 500 (transient). This forces blanket retry strategies and makes auth failures invisible. Combined with F-002/F-004, a 401 on a stale token will not trigger a token refresh.

**Evidence:**
```ruby
if response.code.to_i >= 400
  raise "HTTP Error: #{response.code} - #{response.message}"
end
```

**Recommendation:** Define a typed exception hierarchy (`Api::HTTPError`, `Api::Unauthorized`, `Api::Forbidden`, `Api::ServerError`) carrying status, message, and parsed body. Consider auto-refreshing the token on 401.

**Effort:** S

---

### F-009 — `YAML.safe_load` without explicit permitted classes  🟡 Medium / Security

**File:** `idah/common/lib/role_repository.rb:18, 29`

**Description:** `YAML.safe_load(File.read(file))` is called without the `permitted_classes:` / `permitted_aliases:` kwargs. On Ruby 3.x the default permitted list is `[TrueClass, FalseClass, NilClass, Numeric, String, Symbol, Hash, Array]`, which is safe for the current role YAML, but any future addition of e.g. `Date` or custom types will silently break or require an explicit list.

**Impact:** Low today, but the pattern is fragile. If a contributor adds a `!ruby/object:` tag to a role file (or if `ROLE_PATH` is ever pointed at user-controlled input), this becomes a remote-code-execution vector.

**Evidence:**
```ruby
repo.load_role(YAML.safe_load(File.read(file)))
...
template = YAML.safe_load(File.read(File.join(ROLE_PATH, "templates", "#{file_name}.yml")))
```

**Recommendation:** Pass `permitted_classes: [...]` explicitly even if it matches the default, and validate that `file_name` in `find_template` matches `/\A[\w-]+\z/` before joining paths (currently `find_template` is called with attacker-influenceable `$template_name` from `unfold_rights`, derived from role YAML).

**Effort:** S

---

### F-010 — UUIDv7 has no monotonic counter; sub-ms collision possible  🟡 Medium / CodeSmell

**File:** `idah/common/lib/uuid_v7.rb`, `idah/common/lib/uuid_v7/generator.rb:23-54`

**Description:** The generator uses 48 bits of timestamp + 12 bits `rand_a` + 62 bits `rand_b` from `SecureRandom.gen_random(10)`. There is no per-process monotonic counter to guarantee uniqueness within the same millisecond.

**Impact:** For typical IDAH insert rates this is fine (collision probability is negligible at ~2^-62 per pair within a ms). However, the AGENTS.md mandates `UUIDv7.generate` for primary keys, and any bulk-import path that generates thousands of IDs in a tight loop within one millisecond will rely entirely on randomness. Uniqueness is *probabilistic*, not *guaranteed*.

**Evidence:**
```ruby
rand_a, rand_b1, rand_b2, rand_b3 = SecureRandom.gen_random(10).unpack("nnnN")
```

**Recommendation:** Either (a) document explicitly that uniqueness is probabilistic and acceptable for IDAH's insert rate, or (b) add a per-process monotonic sequence (e.g., 12-bit counter incremented per call within the same ms, replacing `rand_a`). Option (b) matches RFC 9562's recommended variant.

**Effort:** S

---

### F-011 — `Api.all` mutates and re-allocates the page hash each iteration  🟡 Medium / Performance

**File:** `idah/common/lib/api.rb:16-36`

**Description:** `Api.all` reuses the caller's `params` hash, mutating `params[:page][:number]` in place on each iteration. It also calls `output.data.count` which on a JSON:API deserializer likely materializes the whole array just to count it.

**Impact:** Callers passing a shared `params` hash will see their `:page` mutated after the call returns (surprising side effect). Counting via `.count` allocates the full array per page. For large paginations this is O(n²) in memory pressure.

**Evidence:**
```ruby
def self.all(params = {}, &block)
  params[:page] ||= {}
  params[:page][:size] ||= 1_000
  params[:page][:number] ||= 1
  items_per_page = params[:page][:size]
  ...
  Verse::Util::Iterator.chunk_iterator(params[:page][:number]) do |current_page|
    params[:page][:number] = current_page
    ...
    output = block.call(params)
    count = output.data.count
    ...
  end
end
```

**Recommendation:** `dup` the params before mutating. Use `output.data.length` semantics that don't re-materialize, or rely on a `meta.total_items` from the JSON:API document.

**Effort:** S

---

### F-012 — Duplicate `entries.index_all` registration  🟡 Medium / CodeSmell

**File:** `idah/common/lib/api/__map__/dataset.rb:80-91` and `idah/common/lib/api/__map__/dataset.rb:111-122`

**Description:** `Api[:idah].register(:dataset, :entries, :index_all)` is defined twice with identical bodies. The second registration silently overwrites the first via `define_singleton_method`.

**Impact:** Dead code; confusing for maintainers; the diff history suggests one was meant to be removed or renamed.

**Evidence:**
```ruby
# Lines 80-91
Api[:idah].register(:dataset, :entries, :index_all) do |params = {}|
  Api.all(params) do
    output = get("dataset/entries", params:, options: { auth: :bearer })
    deserialize(output.body)
  end
end

# Lines 111-122 — identical
Api[:idah].register(:dataset, :entries, :index_all) do |params = {}|
  ...
end
```

**Recommendation:** Delete one of the duplicates.

**Effort:** S

---

### F-013 — `require "pry"` shipped in production code  🟡 Medium / CodeSmell

**File:** `idah/common/lib/api/exposition.rb:7`

**Description:** `require "pry"` at the top of the exposition file. `pry` is in the `:test` group of the Gemfile, so in production this `require` will fail with `LoadError` unless pry is bundled anyway.

**Impact:** Either (a) production boots fail outright, or (b) pry is being bundled into production images (debug surface, larger image). Either outcome is wrong.

**Evidence:**
```ruby
require "cgi"
require "net/http"
require "json"
require "uri"
require "pry"
```

**Recommendation:** Remove the `require "pry"` line. If a binding shell is needed for debugging, use `binding.pry` behind `if ENV["DEBUG"]` and require it lazily.

**Effort:** S

---

### F-014 — `lazy.select{}.each` swallows exception detail in healthcheck  🟡 Medium / CodeSmell

**File:** `idah/common/lib/healthcheck_service.rb:15-39`

**Description:** Two issues:

1. `plugins.lazy.select { ... }.each { ... }` — `Enumerator::Lazy#select` followed by `each` is functionally equivalent to a plain `each` with an `if`; the laziness buys nothing here because the block has side effects (DB ping) that must all run.
2. The inner `rescue StandardError` sets `status[plugin.name] = "FAILED"` but discards the exception. The healthcheck endpoint therefore returns "FAILED" with no diagnostic, forcing operators to grep logs.

**Impact:** Healthcheck failures are opaque; debugging requires log access. The `lazy` is misleading.

**Evidence:**
```ruby
plugins.lazy.select do |plugin|
  plugin.class <= Verse::Sequel::Plugin
end.each do |plugin|
  plugin.client do |db|
    db.execute("SELECT 1")
    status[plugin.name] = "OK"
  rescue StandardError
    healthy = false
    status[plugin.name] = "FAILED"
  end
end
```

**Recommendation:** Capture `e.message` into `status[plugin.name]` (or a parallel `details` hash). Drop `lazy`. Consider exposing detail only on failure to avoid leaking topology.

**Effort:** S

---

### F-015 — `rescue RuntimeError` references possibly-uninitialized `status`  🟡 Medium / CodeSmell

**File:** `idah/common/lib/healthcheck_service.rb:8-53`

**Description:** The outer `rescue RuntimeError => e` block constructs `Result.new(success?: false, status: status)`. If the RuntimeError is raised before `status = {}` is assigned (e.g., by `Verse::Plugin.all` itself), `status` is undefined and the rescue will itself raise `NameError`.

**Impact:** A failure in `Verse::Plugin.all.values` causes the healthcheck to crash instead of returning a clean failure response.

**Evidence:**
```ruby
def run
  status = {}
  healthy = true
  plugins = Verse::Plugin.all.values
  ...
rescue RuntimeError => e
  Verse.logger&.error "Healthcheck failed: #{e.message}"
  Result.new(success?: false, status: status) # status may be undefined
end
```

**Recommendation:** Move `status = {}` to the very first line, or default inside the rescue: `status ||= {}`. Also broaden the rescue to `StandardError` (currently `Verse::Plugin.all` raising something other than `RuntimeError` will escape).

**Effort:** S

---

### F-016 — `PluginSystem` module-level mutable state without synchronization  🟡 Medium / ThreadSafety

**File:** `idah/common/lib/plugin_system.rb:8-36`

**Description:** `PluginSystem` is `extend self`, so `@config`, `@registry`, `@plugins` are module-instance variables. `init` writes them at boot. The restart path (when implemented per F-006) will mutate `@registry`'s internal `@plugins` hash from event-handler threads while other threads read it.

**Impact:** Concurrent plugin restart vs. plugin lookup is a data race. Ruby's GIL makes this safer than in JVM languages, but Hash mutation during iteration still raises `RuntimeError`.

**Recommendation:** Wrap registry mutations in a `MonitorMixin`; snapshot the plugins hash for read paths.

**Effort:** M

---

### F-017 — `retrieve_plugin(name, version)` references undefined `version`  🟡 Medium / CodeSmell

**File:** `idah/common/lib/plugin_system/registry.rb:17-25`

**Description:** `register(name, path, manual: false)` calls `retrieve_plugin(name, version)` when the path doesn't exist. `version` is never defined in this scope — it would raise `NameError` if this branch were ever hit.

**Impact:** The "fetch from remote repository" code path is dead and would crash if reached. Today it raises `RuntimeError` from inside `retrieve_plugin` itself, masking the bug.

**Evidence:**
```ruby
def register(name, path, manual: false)
  unless Dir.exist?(path)
    if manual
      Verse.logger.warn{ "[IDAH-PLUGIN] Plugin path `#{path}` does not exist." }
      return
    end
    retrieve_plugin(name, version)  # version undefined
  end
  ...
end
```

**Recommendation:** Either remove the unimplemented branch or thread `version` through the signature. Mark `retrieve_plugin` as `raise NotImplementedError` explicitly.

**Effort:** S

---

### F-018 — `Plugin#reload` calls `start` without required `context_class`  🟡 Medium / CodeSmell

**File:** `idah/common/lib/plugin_system/plugin.rb:80-85` vs `lib/plugin_system/plugin.rb:30`

**Description:** `Plugin#start(context_class)` requires a `context_class` argument, but `Plugin#reload` calls `start` with no arguments. This will raise `ArgumentError` on any reload.

**Impact:** Plugin reload is broken at runtime.

**Evidence:**
```ruby
def reload
  Verse.logger.info{ "Reload plugin #{manifest.name}" }
  stop
  start  # missing context_class
  ...
end
```

**Recommendation:** Store the `context_class` on the instance during the first `start`, and reuse it in `reload`.

**Effort:** S

---

### F-019 — Compound-role dedup logic reverses semantics ambiguously  🟡 Medium / CodeSmell

**File:** `idah/common/lib/role_backend.rb:39-44`

**Description:** After concatenating rights, the dedup does `rights.reverse.uniq { |right| right.split(".", 2).first }`. The comment says "the last action has the proper scope", but `reverse + uniq` keeps the *first* occurrence in the reversed array, i.e., the *last* in the original. This is correct only if sub-rights are appended after main rights, which they are (`sum(rights)` uses `rights` as the initial accumulator). The logic is correct but opaque.

**Impact:** Future maintainers will likely misread this and "fix" it incorrectly. No functional bug today.

**Evidence:**
```ruby
rights = sub_rights.map(&:rights).sum(rights)
rights.reverse.uniq { |right| right.split(".", 2).first }
```

**Recommendation:** Rewrite as `sub_rights.map(&:rights).reduce(rights) { |acc, r| acc + (r - acc.select { |x| x.split(".", 2).first == ... }) }` or simply add a unit test that pins the precedence semantics, plus a clearer comment.

**Effort:** S

---

### F-020 — `SecureRandom` referenced but not required  🟢 Low / CodeSmell

**File:** `idah/common/lib/api/exposition.rb:174`

**Description:** `SecureRandom.hex(16)` is used to build the multipart boundary, but `require "securerandom"` is only in `multipart_stream.rb`, not in `exposition.rb`. This works only because something else in the process has loaded securerandom first.

**Impact:** Brittle; will break if load order changes.

**Recommendation:** Add `require "securerandom"` at the top of `exposition.rb`.

**Effort:** S

---

### F-021 — `compound_role` overwrites `rights` variable; dead assignment  🟢 Low / CodeSmell

**File:** `idah/common/lib/role_backend.rb:29-39`

**Description:** `rights = main_role.rights.dup` is immediately followed by `sub_rights = sub_rights.map { ... }` and then `rights = sub_rights.map(&:rights).sum(rights)`. The `dup` on the first line is pointless because the original `rights` array is replaced, not mutated. The `.dup` is dead.

**Evidence:**
```ruby
rights = main_role.rights.dup
sub_rights = sub_rights.map do |scope|
  ...
end
rights = sub_rights.map(&:rights).sum(rights)
```

**Recommendation:** Drop `.dup`.

**Effort:** S

---

### F-022 — `build_uri` accepts unused `_headers` parameter  🟢 Low / CodeSmell

**File:** `idah/common/lib/api/exposition.rb:107-119`

**Description:** `build_uri(path, method, params, _headers)` — the `_headers` arg is named with the underscore convention to indicate "unused", but it's still threaded through from `execute_request`. Either it should be used (e.g., to honor a `Host` header) or removed.

**Recommendation:** Remove the parameter; update the call site.

**Effort:** S

---

### F-023 — `SemanticVersion` does not support pre-release / build metadata  🟢 Low / CodeSmell

**File:** `idah/common/lib/semantic_version.rb:9`

**Description:** The regex `^\d+\.\d+\.\d+$` rejects valid SemVer 2.0 strings like `1.0.0-rc1` or `1.0.0+build.42`. The class is named `SemanticVersion`, implying SemVer compliance.

**Impact:** Any caller that passes a real-world SemVer (e.g., a plugin version with a pre-release tag) will hit `ArgumentError`. The plugin manifest schema (`manifest.rb:7`) accepts arbitrary `String` for `version`, so this is reachable.

**Recommendation:** Either rename to `SimpleVersion` or extend the regex to `^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-.]+))?(?:\+([0-9A-Za-z-.]+))?$` and implement pre-release comparison per SemVer 2.0 §11.

**Effort:** M

---

### F-024 — Regex-based `updated_at` detection in trigger is brittle  🟢 Low / CodeSmell

**File:** `idah/common/lib/migration/timestamps.rb:12`

**Description:** The trigger function decides whether to overwrite `NEW.updated_at` based on a regex match against `current_query()`: `IF current_query() !~ '[^a-zA-Z0-9_]updated_at[^a-zA-Z0-9_]'`. This relies on the literal token `updated_at` appearing in the SQL text.

**Impact:** A query like `UPDATE t SET "updated_at" = NOW()` will be detected, but `UPDATE t SET UPDATED_AT = ...` (uppercase) will not (PostgreSQL regex is case-sensitive by default). Also, any query that *mentions* `updated_at` in a comment or WHERE clause will incorrectly skip the update.

**Recommendation:** Use `NEW.updated_at IS NULL` as the trigger condition, or compare `NEW.updated_at = OLD.updated_at` to decide whether the caller set it explicitly.

**Effort:** S

---

### F-025 — N+1 update loop in duplicate field helper  🟢 Low / Performance

**File:** `idah/common/lib/expo/util/duplicate_field_helper.rb:33-35`

**Description:** For each record matched by the foreign key, `repo.update(record[:id], ...)` is called in a loop. This is an N+1 update pattern.

**Impact:** For tables with many child records, this issues N UPDATE queries where one would suffice.

**Evidence:**
```ruby
records.each do |record|
  repo.update(record[:id], fields_to_update.transform_values { |v| update_values[v] })
end
```

**Recommendation:** Use a single `repo.table.where(foreign_key => record_id).update(fields_to_update)` (respecting scoping).

**Effort:** S

---

### F-026 — `Api::Service#path` defined but never called  🟢 Low / CodeSmell

**File:** `idah/common/lib/api/service.rb:23-29`

**Description:** `Service#path(path = "")` joins `base_url`, `base_path`, and `path`, but every registered endpoint constructs its own path string literal (e.g., `"dataset/entries/:id"`). The method is dead.

**Recommendation:** Either wire the registered endpoints through `Service#path` (so `base_path` is actually applied — currently it isn't!), or remove it. Note that **not** using `Service#path` means `base_path = "dataset"` configured in `__include__.rb` has no effect today.

**Effort:** S

---

### F-027 — `Dir.glob` eager-require bypasses Zeitwerk  ⚪ Info / Architecture

**File:** `idah/common/lib/api.rb:71-73`

**Description:** At the bottom of `api.rb`, all `api/__map__/*.rb` files are eagerly `require`d. This works but bypasses Zeitwerk's lazy loading and naming conventions.

**Impact:** None functionally. Stylistically inconsistent with the rest of the codebase, which relies on Zeitwerk.

**Recommendation:** Acceptable as-is for a one-time bootstrap. Document why eager loading is required (the `__map__` files mutate the `Api[:idah]` singleton at load time).

**Effort:** S

---

### F-028 — `execute_request` is long and mixes concerns  ⚪ Info / CodeSmell

**File:** `idah/common/lib/api/exposition.rb:46-85`

**Description:** `execute_request` does path templating, URI building, request construction, auth injection, HTTP client creation, and response handling in one ~40-line method.

**Recommendation:** Extract `apply_path_template`, `build_http_client`, and `handle_response` for testability.

**Effort:** M

---

### F-029 — All Verse gems pinned to `master` / feature branches  ⚪ Info / CodeSmell

**File:** `idah/common/Gemfile:7-11`

**Description:** `verse-core`, `verse-http`, `verse-jsonapi`, `verse-redis`, `verse-sequel` are all sourced from `github:` with `branch: "master"` (or a feature branch for `verse-http`). No tags or SHAs are pinned.

**Impact:** Any upstream commit to those branches changes IDAH's framework behavior on the next `bundle install`. Reproducibility of builds depends entirely on the upstream branches not being force-pushed.

**Recommendation:** Pin to a specific commit SHA (`ref:`) or tag, and bump deliberately.

**Effort:** S

---

### F-030 — RuboCop excludes `common/**/*` from enforcement  ⚪ Info / CodeSmell

**File:** `idah/common/.rubocop.yml:6-7`

**Description:** The `.rubocop.yml` inside `common/` excludes `common/**/*` from RuboCop. This means none of the findings in this audit are caught by linting.

**Impact:** Style and many minor correctness issues will accumulate undetected.

**Recommendation:** Re-enable RuboCop for `common/` with a separate TODO file (`@rubocop-todo.yml`) for gradual cleanup.

**Effort:** M

---

## Cross-Cutting Observations

These are not individual findings but recurring patterns worth flagging:

1. **No structured error type for the API client.** Every failure raises bare `RuntimeError` with a stringly-typed message. Callers cannot rescue selectively. This affects F-008, F-006, F-017, F-018.
2. **The `Api[:idah]` provider's `base_path` configuration is dead code** (F-026). Endpoints hardcode the service prefix in their path strings. Either remove `base_path` or use it.
3. **Auth-context bypass is the default for system-level reads** (F-005, `RoleRepository.load`). The codebase needs a documented, auditable pattern for "this repository intentionally reads system-wide data" rather than ad-hoc `Verse::Auth::Context.new`.
4. **Concurrency primitives are inconsistent.** `ThreadPool` includes `MonitorMixin` but doesn't use the condition variable; `PluginSystem` has no synchronization at all; `generate_token` has none. The AGENTS.md mandate for `MonitorMixin` is only partially honored.
5. **Several "TODO" / "not implemented yet" code paths are reachable in production** (F-006, F-017, F-018). They will raise at runtime rather than fail fast at boot.

---

## Files Reviewed

| Path | Status |
|------|--------|
| `idah/common/Gemfile` | ✅ |
| `idah/common/.rubocop.yml` | ✅ |
| `idah/common/lib/api.rb` | ✅ |
| `idah/common/lib/api/exposition.rb` | ✅ |
| `idah/common/lib/api/multipart_stream.rb` | ✅ |
| `idah/common/lib/api/service.rb` | ✅ |
| `idah/common/lib/api/__map__/__include__.rb` | ✅ |
| `idah/common/lib/api/__map__/dataset.rb` | ✅ |
| `idah/common/lib/api/__map__/iam.rb` | ✅ |
| `idah/common/lib/api/__map__/media.rb` | ✅ |
| `idah/common/lib/api/__map__/setting.rb` | ✅ |
| `idah/common/lib/expo/util/duplicate_field_helper.rb` | ✅ |
| `idah/common/lib/healthcheck_expo.rb` | ✅ |
| `idah/common/lib/healthcheck_service.rb` | ✅ |
| `idah/common/lib/migration/timestamps.rb` | ✅ |
| `idah/common/lib/plugin_system.rb` | ✅ |
| `idah/common/lib/plugin_system/config.rb` | ✅ |
| `idah/common/lib/plugin_system/exposition.rb` | ✅ |
| `idah/common/lib/plugin_system/manifest.rb` | ✅ |
| `idah/common/lib/plugin_system/plugin.rb` | ✅ |
| `idah/common/lib/plugin_system/registry.rb` | ✅ |
| `idah/common/lib/resource/audit.rb` | ✅ |
| `idah/common/lib/resource/dataset.rb` | ✅ |
| `idah/common/lib/resource/iam.rb` | ✅ |
| `idah/common/lib/resource/media.rb` | ✅ |
| `idah/common/lib/resource/setting.rb` | ✅ |
| `idah/common/lib/resource/sync.rb` | ✅ |
| `idah/common/lib/role_backend.rb` | ✅ |
| `idah/common/lib/role_record.rb` | ✅ |
| `idah/common/lib/role_repository.rb` | ✅ |
| `idah/common/lib/semantic_version.rb` | ✅ |
| `idah/common/lib/service/notification.rb` | ✅ |
| `idah/common/lib/thread_pool.rb` | ✅ |
| `idah/common/lib/uuid_v7.rb` | ✅ |
| `idah/common/lib/uuid_v7/generator.rb` | ✅ |

Spec files reviewed for context (not in audit scope but read for cross-referencing): `healthcheck_expo_spec.rb`, `role_backend_spec.rb`, `thread_pool_spec.rb`, `plugin_system/manifest_spec.rb`.

---

*End of report. No code was modified. Findings only.*
