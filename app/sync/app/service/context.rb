module Context
  Root = Data.define(:name, :api)

  def self.root(args, api = :idah)
    Root.new(
      [:export, Time.now.to_i].join("."),
      ContextApi.api(args, api)
    )
  end
end
