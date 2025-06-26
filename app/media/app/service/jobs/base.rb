module Jobs
  class Base
    attr_reader :params

    def initialize(params)
      @params = params
    end

    def run = raise NotImplementedError
  end
end