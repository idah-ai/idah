# frozen_string_literal: true

class SemanticVersion
  attr_reader :major, :minor, :patch

  def initialize(str)
    # Assert that the format is correct:

    if str !~ /^\d+\.\d+\.\d+$/
      raise ArgumentError, "Invalid semantic version format: #{str}"
    end

    @major, @minor, @patch = str.split(".").map(&:to_i)
  end

  def self.[](str)
    new(str)
  end

  def <=>(other)
    return nil unless other.is_a?(SemanticVersion)

    if @major != other.major
      @major <=> other.major
    elsif @minor != other.minor
      @minor <=> other.minor
    else
      @patch <=> other.patch
    end
  end

  def to_s
    "#{@major}.#{@minor}.#{@patch}"
  end
end
