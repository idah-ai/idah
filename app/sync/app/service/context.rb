module Context
  def self.new(context = nil)
    return context if context&.is_a?(Base)

    return EnumerableContext.new(context) if context&.respond_to?(:each)

    Base.new(context)
  end
end