# frozen_string_literal: true

# Pure diff/merge helpers for annotation values, stored in
# `annotation_changes.changes` as `[op, path, old, new]` entries.
#
# `call` produces the changes between two hashes, `apply`/`revert` replay or
# undo them. None of them touch the database or the plugin manifests: which
# arrays are keyed (and by what) is decided by the caller through
# `identity_keys:`, and every path carries that key on its own, so history
# stays replayable even if a plugin is removed later.
#
# Partial updates are the caller's job: `call` records a `-` for every key
# that is present in `old` but absent in `new`, so a caller that wants an
# untouched field ignored passes old and new hashes sliced to the keys it
# writes (the repository's `update` does exactly that).
module AnnotationDiff
  SEPARATOR = "."

  # The content of a keyed segment, `key=value` (value is JSON, `]`/`\\` escaped).
  KEYED_CONTENT_RE = /^([^\[\]=]+)=(.*)$/

  module_function

  # Returns [[op, path, old, new], ...].
  #
  # Recursive diff: hashes and keyed arrays are recursed into; non-keyed
  # arrays and type changes are compared whole. Keys present only in
  # `old_hash` are recorded as `-` (removed); keys present only in `new_hash`
  # as `+` (added).
  #
  # `identity_keys` maps array paths inside `shape_args` to the key that
  # identifies their items, e.g. { "frames" => "frame" }. With `{}`, and for
  # every other array, items are compared whole.
  def call(old_hash, new_hash, identity_keys: {})
    old_hash = normalize(old_hash) || {}
    new_hash = normalize(new_hash) || {}

    changes = []

    (old_hash.keys - new_hash.keys).each do |key|
      changes << ["-", escape(key.to_s), old_hash[key], nil]
    end

    (new_hash.keys - old_hash.keys).each do |key|
      changes << ["+", escape(key.to_s), nil, new_hash[key]]
    end

    (new_hash.keys & old_hash.keys).each do |key|
      compare_value!(changes, escape(key.to_s), old_hash[key], new_hash[key], identity_keys:)
    end

    changes
  end

  # Replay `changes` onto `state_hash` and return the new hash. Never mutates
  # its inputs.
  def apply(state_hash, changes)
    run(state_hash, changes, direction: :forward)
  end

  # Undo `changes` from `state_hash` and return the new hash. Never mutates
  # its inputs.
  def revert(state_hash, changes)
    run(state_hash, changes, direction: :backward)
  end

  # Build a dot-joined path from segments. Keyed array segments are passed as a
  # single string (`"frames[frame=57]"`); `path` does not escape anything —
  # escaping happens when `call` builds paths from hash keys, and `parse_path`
  # inverts that.
  def path(*segments)
    segments.map(&:to_s).join(SEPARATOR)
  end

  # Invert `path` exactly: split on unescaped separators, keep keyed brackets
  # attached to their name, undo the escapes of plain segments. Returns tagged
  # tuples so consumers never re-detect keyed segments or unescape twice:
  # `[:plain, name]` or `[:keyed, name, key, value]`.
  def parse_path(string)
    split_path(string).map do |segment, bracket_content|
      if bracket_content
        name = segment.delete_suffix("[#{bracket_content}]")
        [:keyed, unescape(name), unescape_bracket(bracket_content[KEYED_CONTENT_RE, 1]),
         JSON.parse(unescape_bracket(bracket_content[KEYED_CONTENT_RE, 2]))]
      else
        [:plain, unescape(segment)]
      end
    end
  end

  # Split a path into raw segments on unescaped separators, keeping keyed
  # brackets attached to their name (dots inside brackets are not separators)
  # and yielding an empty plain segment for an empty key ("metadata." →
  # ["metadata", ""]). Escaped characters (`\.`, `\[`, `\]`, `\\`) are kept
  # verbatim and unescaped later, so an escaped `]` in a plain segment is not
  # mistaken for a real closing bracket. Returns `[segment, bracket_content]`
  # pairs where `bracket_content` is the raw text between the brackets (or nil
  # for a plain segment), so the caller never re-detects the bracket with a
  # regex.
  #
  # A single in-bracket flag is used rather than a depth counter: keyed values
  # may themselves contain an unescaped `[` (keyed_path only escapes `]` and
  # `\` inside brackets), so `[` opens only when not already in a bracket and
  # only an unescaped `]` closes it.
  def split_path(string)
    segments = []
    current = +""
    in_bracket = false
    bracket_content = nil
    s = string.to_s
    i = 0
    while i < s.length
      c = s[i]
      if c == "\\" && i + 1 < s.length
        current << c << s[i + 1]
        bracket_content << c << s[i + 1] if in_bracket
        i += 2
        next
      end
      case c
      when "["
        if in_bracket
          bracket_content << c
        else
          in_bracket = true # rubocop:disable Lint/UselessAssignment -- loop-carried flag
          bracket_content = +""
        end
      when "]"
        in_bracket = false if in_bracket
      when "."
        if in_bracket
          bracket_content << c
        else
          segments << [current, bracket_content]
          current = +""
          bracket_content = nil
          i += 1
          next
        end
      else
        bracket_content << c if in_bracket
      end
      current << c
      i += 1
    end
    segments << [current, bracket_content]
    segments
  end

  # ── Normalization ────────────────────────────────────────────────────────

  # Deep-stringify keys on both sides (shape_args arrives with symbol keys,
  # Postgres returns string keys, and raw reads through Sequel's pg_json
  # extension hold JSONB* wrappers). Convert Time values to ISO 8601 UTC
  # strings with microseconds, so `deleted_at` is stored and compared the same
  # way on both sides. Values are otherwise compared with Ruby `==`, so
  # `1 == 1.0` is unchanged.
  def normalize(value)
    case value
    when Hash
      value.each_with_object({}) do |(key, child), out|
        out[key.to_s] = normalize(child)
      end
    when Array
      value.map { |child| normalize(child) }
    when Time
      value.utc.iso8601(6)
    when ::Sequel::Postgres::JSONObject, ::Sequel::Postgres::JSONBObject
      # Unwrap JSON/JSONB wrappers (Hash/Array/primitive).
      normalize(value.__getobj__)
    else
      value
    end
  end

  # ── Comparing ─────────────────────────────────────────────────────────────

  def compare_value!(changes, path, old_value, new_value, identity_keys:)
    return if old_value == new_value

    if old_value.nil? || new_value.nil?
      # Present before and after, value differs — including values that are
      # nil on either side: `~`.
      changes << ["~", path, old_value, new_value]
      return
    end

    if old_value.is_a?(Hash) && new_value.is_a?(Hash)
      compare_hashes!(changes, path, old_value, new_value, identity_keys:)
    elsif old_value.is_a?(Array) && new_value.is_a?(Array)
      compare_arrays!(changes, path, old_value, new_value, identity_keys:)
    else
      # Type change (e.g. Hash to Array) gives a single entry.
      changes << ["~", path, old_value, new_value]
    end
  end

  def compare_hashes!(changes, path, old_hash, new_hash, identity_keys:)
    (old_hash.keys - new_hash.keys).each do |key|
      changes << ["-", path + SEPARATOR + escape(key.to_s), old_hash[key], nil]
    end

    (new_hash.keys - old_hash.keys).each do |key|
      changes << ["+", path + SEPARATOR + escape(key.to_s), nil, new_hash[key]]
    end

    (new_hash.keys & old_hash.keys).each do |key|
      compare_value!(changes, path + SEPARATOR + escape(key.to_s), old_hash[key], new_hash[key], identity_keys:)
    end
  end

  def compare_arrays!(changes, path, old_array, new_array, identity_keys:)
    # `identity_keys` maps array paths *inside shape_args* to the key that
    # identifies their items ({ "frames" => "frame" }); the compare path here
    # carries the `shape_args.` prefix.
    if (identity_key = identity_keys[path] || identity_keys[path.delete_prefix("shape_args.")])
      keyed_old = keyed_items(old_array, identity_key)
      keyed_new = keyed_items(new_array, identity_key)

      if keyed_old && keyed_new
        compare_keyed_arrays!(changes, path, keyed_old, keyed_new, identity_key)
        return
      end
    end

    # Other arrays are compared whole: equal, or a single entry with both full
    # arrays.
    changes << ["~", path, old_array, new_array] unless old_array == new_array
  end

  # Fallback: if on either side any item of a keyed array is not a Hash,
  # lacks the key, or shares its key value with another item, the array is
  # compared whole.
  def keyed_items(array, identity_key)
    keys = []
    items = []

    array.each do |item|
      return nil unless item.is_a?(Hash)
      return nil unless item.key?(identity_key)

      keys << item[identity_key]
      items << item
    end

    return nil unless keys.uniq.size == keys.size

    keys.zip(items)
  end

  def compare_keyed_arrays!(changes, path, old_items, new_items, identity_key)
    old_by_key = old_items.to_h
    new_by_key = new_items.to_h

    (old_by_key.keys - new_by_key.keys).each do |key|
      changes << ["-", keyed_path(path, identity_key, key), old_by_key[key], nil]
    end

    (new_by_key.keys - old_by_key.keys).each do |key|
      changes << ["+", keyed_path(path, identity_key, key), nil, new_by_key[key]]
    end

    (new_by_key.keys & old_by_key.keys).each do |key|
      compare_value!(
        changes,
        keyed_path(path, identity_key, key),
        old_by_key[key],
        new_by_key[key],
        identity_keys: {}
      )
    end
  end

  # "frames[frame=57]" / "frames[id=\"a1\"]" — the item key is written as JSON,
  # with any `]` or `\` inside it escaped so the segment stays unambiguous.
  def keyed_path(path, key, item_key)
    value = JSON.generate(item_key).gsub(/[\\\]]/) { |c| "\\#{c}" }
    "#{path}[#{key}=#{value}]"
  end

  # ── Applying / reverting ───────────────────────────────────────────────────

  def run(state_hash, changes, direction:)
    state = normalize(state_hash) || {}

    changes.each do |op, path, old_value, new_value|
      apply_change!(state, op, path, old_value, new_value, direction:)
    end

    state
  end

  # Mutates `state` (the freshly normalized deep copy) in place.
  def apply_change!(state, change_op, path, old_value, new_value, direction:)
    segments = parse_path(path)
    last = segments.pop or raise ArgumentError, "empty change path: #{path.inspect}"

    # Descend, creating missing containers so a `+` can build its path.
    chain = []
    current = state
    segments.each do |segment|
      parent = current
      current = descend(current, segment)
      chain << [parent, segment, current]
    end

    case direction
    when :forward
      case change_op
      when "+" then set_value(current, last, new_value)
      when "-" then delete_value(current, last)
      when "~" then set_value(current, last, new_value)
      end
    when :backward
      case change_op
      when "+" then delete_value(current, last)
      when "-" then set_value(current, last, old_value)
      when "~" then set_value(current, last, old_value)
      end
    end

    prune_empty_containers(chain)
  end

  # Descend one segment (plain hash key or keyed array item) into `value`,
  # creating the container when it does not exist yet. `segment` is a tuple
  # from `parse_path`.
  def descend(value, segment)
    if segment[0] == :keyed
      _tag, name, key, item_key = segment

      array = value[name]
      unless array.is_a?(Array)
        array = value[name] = []
      end

      index = array.index { |item| item.is_a?(Hash) && item[key] == item_key }
      return array[index] if index

      item = { key => item_key }
      insert_keyed_item(array, key, item_key, item)
      item
    else
      _tag, name = segment
      child = value[name]
      unless child.is_a?(Hash)
        child = value[name] = {}
      end
      child
    end
  end

  def set_value(parent, last, value)
    if last[0] == :keyed
      _tag, name, key, item_key = last

      array = parent[name]
      unless array.is_a?(Array)
        array = parent[name] = []
      end

      index = array.index { |item| item.is_a?(Hash) && item[key] == item_key }
      if index
        array[index] = normalize(value)
      else
        insert_keyed_item(array, key, item_key, normalize(value))
      end
    else
      parent[last[1]] = normalize(value)
    end
  end

  def delete_value(parent, last)
    if last[0] == :keyed
      _tag, name, key, item_key = last

      array = parent[name]
      return unless array.is_a?(Array)

      array.delete_if { |item| item.is_a?(Hash) && item[key] == item_key }
    else
      parent.delete(last[1])
    end
  end

  # After a deletion, walk the ancestor chain back up and drop containers that
  # became empty, so a reverted `+` restores an equivalent state: an empty
  # container that existed before the `+` is pruned, and keyed items are
  # re-inserted in ascending key order.
  def prune_empty_containers(chain)
    chain.reverse_each do |parent, segment, child|
      if segment[0] == :keyed
        name = segment[1]
        array = parent[name]
        if array.is_a?(Array) && array.empty?
          parent.delete(name)
        end
      elsif child.is_a?(Hash) && child.empty?
        parent.delete(segment[1])
      end
    end
  end

  # Insert a keyed item at its position in ascending key order (the only
  # placement rule `apply`/`revert` need, since keyed items compare without
  # regard to order).
  def insert_keyed_item(array, key, item_key, item)
    index = array.index do |existing|
      next false unless existing.is_a?(Hash)

      compare = existing[key] <=> item_key
      compare == 1
    end

    array.insert(index || array.length, item)
  end

  # ── Escaping ──────────────────────────────────────────────────────────────

  # Plain segments: hash keys may contain `.`, `[`, `]` or `\`, escaped with
  # `\`. Bracket content (keyed values) escapes only `]` and `\`.
  def escape(segment)
    segment.to_s.gsub(/([.\[\]\\])/) { |c| "\\#{c}" }
  end

  def unescape(segment)
    segment.gsub(/\\([.\[\]\\])/, '\1')
  end

  def unescape_bracket(segment)
    segment.gsub(/\\([\]\\])/, '\1')
  end
end
