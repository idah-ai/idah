module Context
  Root = Data.define(:file, :api)

  def self.root(file, args, api = :idah)
    Root.new(
      file,
      ContextApi.api(args, api)
    )
  end
end
