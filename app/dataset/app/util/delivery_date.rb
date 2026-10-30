# frozen_string_literal: true

module DeliveryDate
  def self.validate!(attributes, original = nil)
    return unless attributes.key?(:delivery_date)

    value = attributes[:delivery_date]
    return if value.nil? || value == original
    return unless value < Date.today

    raise Verse::Error::ValidationFailed, "Delivery Date must be today or later"
  end
end
