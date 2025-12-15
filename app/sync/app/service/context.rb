module Context
  Root = Data.define(:io, :api)

  def self.root(io, args, api = :idah)
    Root.new(
      io,
      ContextApi.api(args, api)
    )
  end
end
