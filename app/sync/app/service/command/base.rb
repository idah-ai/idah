module Command
  def self.valid_io!(io, name)
    name ||= io.class.name
    if (io.nil? || io.is_a?(IO))
      io
    else
      raise [:invalid_io, name, io.class].join(" ")
    end
  end

  class Base
    attr_reader :filename, :opts
    attr_accessor :i, :o, :e, :wait_thr
    def initialize(i = nil, o = nil, e = nil, wait_thr = nil, filename:, **opts)
      @filename = filename || [self.name, Time.now.to_i].join(".")
      @opts = opts
      @i = Command.valid_io!(i, :i)
      @o = Command.valid_io!(o, :o)
      @e = Command.valid_io!(e, :e)
      @wait_thr = wait_thr
    end

    def close
      i.close if i && !i.closed?
      if (e && !e.closed? && wait_thr)
        remaining_stderr = []
        remaining_stderr << line while (line = e.gets)
        value = wait_thr.value
        if value.exitstatus != 0
          raise ["#{self}(#{value}):", remaining_stderr.join("\n")].join
        end
      end
      o.close if o && !o.closed?
      e.close if e && !e.closed?
      Verse::logger.debug {"closed #{self}"}
    end
  end
end