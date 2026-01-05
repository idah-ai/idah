module Context
  module IoContext
    class Base < Context::Base
      attr_reader :filename
      attr_accessor :i, :o, :e, :wait_thr

      def initialize(filename, i = nil, o = nil, e = nil, wait_thr = nil)
        @filename = filename
        @i = i
        @o = o
        @e = e
        wait_thr = wait_thr
        super(self)
      end
    end
  end
end