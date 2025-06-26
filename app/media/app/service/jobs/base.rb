module Jobs
  class Base
    attr_reader :params

    def inititalize(params)
      @params = params
    end

    def run
      raise NotImplementedError, "Subclasses must implement the run method"
    end
  end
end