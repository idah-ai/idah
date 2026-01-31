require 'rmagick'

(1..300).each do |number|
  # Create a black 360p image (640x360)
  img = Magick::Image.new(640, 360) do |image|
    image.background_color = 'black'
  end

  # Add white text in the center
  text = Magick::Draw.new
  text.fill = 'white'
  text.gravity = Magick::CenterGravity
  text.pointsize = 100
  text.font_weight = Magick::BoldWeight
  text.annotate(img, 0, 0, 0, 0, number.to_s)

  # Save the image
  img.write("output/image_#{number.to_s.rjust(3, '0')}.png")

  puts "Generated image #{number}"
end

puts "Done! Generated 300 images."
