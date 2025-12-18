module Context
  Root = Data.define(:ios, :api)

  def self.root(ios, args, api = :idah)
    Root.new(
      ios,
      ContextApi.api(args, api)
    )
  end
end
