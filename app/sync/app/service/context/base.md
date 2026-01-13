# Context::Base Implementation Summary

## Overview

The `Context::Base` class provides a flexible system for managing context-aware filters and options across multiple APIs. It uses a precedence-based merging system to combine data from different sources.

## Core Concepts

### 1. Contextualized vs Non-Contextualized Data

- **Contextualized**: Hash nested under API names, e.g., `{ test_api: { key: 'value' } }`
- **Non-Contextualized**: Flat hash, e.g., `{ key: 'value' }`

### 2. Precedence Rules

#### For Filters (build_filters):

**Class Method**: `passed_filters < passed_context_args < passed_args`

- `passed_filters`: Non-contextualized, lowest precedence
- `passed_context_args`: Contextualized, middle precedence
- `passed_args`: Contextualized, highest precedence

**Instance Method**: `passed_filters < passed_context_args < @context_args < passed_args < @args`

- Instance variables (`@args`, `@context_args`) take highest precedence
- Passed parameters fill in gaps

#### For Opts (build_opts):

**Class Method**: `opts < passed_opts`

- `opts`: Non-contextualized, lower precedence
- `passed_opts`: Contextualized, higher precedence

**Instance Method**: `opts < passed_opts < @opts`

- Instance variable `@opts` has highest precedence

## Method Signatures & Behavior

### Class Methods

```ruby
# Builds filters for a single API
def self.build_filters(
  passed_filters = nil,      # Non-contextualized
  delegated_obj_name = nil,  # API name to extract from contextualized hashes
  passed_args = nil,         # Contextualized
  passed_context_args = nil  # Contextualized
)
```

```ruby
# Aggregates filters across all APIs
def self.build_context_args(
  passed_args = nil,         # Contextualized
  passed_context_args = nil  # Contextualized
) # Returns: { api1: {filters}, api2: {filters}, ... }
```

```ruby
# Builds opts for a single API
def self.build_opts(
  delegated_obj_name = nil,  # API name
  opts = nil,                # Non-contextualized
  passed_opts = nil          # Contextualized
)
```

```ruby
# Aggregates opts across all APIs
def self.build_context_opts(
  opts = nil,                # Contextualized
  passed_opts = nil          # Contextualized
) # Returns: { api1: {opts}, api2: {opts}, ... }
```

### Instance Methods

```ruby
# Merges with instance variables @args and @context_args
def build_filters(
  passed_filters = nil,
  delegated_obj_name = nil,
  passed_context_args = nil,
  passed_args = nil
)
```

```ruby
# Aggregates using @args, @context_args, and passed parameter
def build_context_args(passed_context_args = nil)
```

```ruby
# Merges with instance variable @opts
def build_opts(
  opts = nil,
  delegated_obj_name = nil,
  passed_opts = nil
)
```

```ruby
# Aggregates using @opts and passed parameter
def build_context_opts(opts = nil)
```

## Usage Examples

### Basic Filter Building

```ruby
# Class method - single API
filters = Context::Base.build_filters(
  { shared: 'from_filters' },
  :test_api,
  { test_api: { shared: 'from_args', key1: 'value1' } },
  { test_api: { key2: 'value2' } }
)
# => { shared: 'from_args', key1: 'value1', key2: 'value2' }
```

### Aggregating Across APIs

```ruby
# Class method - multiple APIs
context_args = Context::Base.build_context_args(
  { api1: { key1: 'args' }, api2: { key3: 'args' } },
  { api1: { key2: 'context' } }
)
# => { api1: {key1: 'args', key2: 'context'}, api2: {key3: 'args'} }
```

### Using Instance Methods

```ruby
# Create instance with context
instance = Context::Base.new(
  api_object,
  { test_api: { id: '123' } },           # @args
  { test_api: { filter: 'active' } },    # @context_args
  { test_api: { page_size: 100 } }       # @opts
)

# Instance vars take precedence
filters = instance.build_filters({ id: '456' }, :test_api)
# => { id: '123', filter: 'active' }  # @args['id'] wins

# Aggregate all context
context = instance.build_context_args
# => { test_api: { id: '123', filter: 'active' } }

# Build opts with precedence
opts = instance.build_opts({ page_size: 50 }, :test_api)
# => { page_size: 100 }  # @opts wins
```

### Chaining Contexts

```ruby
# Build context from one API to pass to another
org_instance = Context::Base.new(
  org_api,
  { organizations: { id: 'org-123' } }
)

# Get aggregated context
context = org_instance.build_context_args
# => { organizations: { id: 'org-123' } }

# Pass to related API
project_instance = Context::Base.new(
  project_api,
  { projects: { organization_id: 'org-123' } },
  context  # Use as context_args
)

# Filters now include both
filters = project_instance.build_filters({}, :projects)
# => { organization_id: 'org-123' }
```

## Key Implementation Details

### Deep Merging at Key Level

The instance `build_context_args` method performs deep merging within each API:

```ruby
# For each API, merge all three sources
api1_data: passed[api1] < @context_args[api1] < @args[api1]
api2_data: passed[api2] < @context_args[api2] < @args[api2]
```

### Empty Hash Handling

All methods return `nil` instead of empty hashes:

```ruby
filters.empty? ? nil : filters
```

### API Name Resolution

Instance methods use `delegated_obj_name || name` to resolve the API name, falling back to the wrapped object's name or class name.

## Common Patterns

### Security Context

```ruby
# User context limits what can be accessed
user_context = Context::Base.new(
  api,
  { projects: { user_id: current_user.id } }
)

# All project queries automatically filtered by user_id
projects = user_context.index
```

### Multi-tenancy

```ruby
# Organization context
org_context = { organizations: { id: 'org-123' } }

# Automatically scopes all child resources
projects = Context::Base.new(project_api, nil, org_context)
datasets = Context::Base.new(dataset_api, nil, org_context)
```

### Configuration Layers

```ruby
# Global config
global_opts = { apis: { timeout: 30 } }

# Environment config (higher precedence)
env_opts = { apis: { timeout: 60, retry: 3 } }

instance = Context::Base.new(api, nil, nil, global_opts)
opts = instance.build_opts(env_opts, :apis)
# => { timeout: 60, retry: 3 }  # env wins on timeout # TODO check 30 might be better
```
