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
    def initialize(filename = nil, opts = nil, i = nil, o = nil, e = nil, wait_thr = nil)
      @filename = filename
      @opts = opts
      @i = Command.valid_io!(i, :i)
      @o = Command.valid_io!(o, :o)
      @e = Command.valid_io!(e, :e)
      @wait_thr = wait_thr
      puts(self)
    end

  end
end