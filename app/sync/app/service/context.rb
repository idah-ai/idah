module Context
  def self.new(context = nil)
    if context&.is_a?(Base)
      context
    elsif context&.respond_to?(:each)
      EnumerableContext.new(context)
    else
      Base.new(context)
    end
  end
end