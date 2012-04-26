require "rest_client"

puts "Uploading file..."
r = RestClient.post 'http://muusio-mothership.herokuapp.com/upload', :file => File.new("/Users/lincoln/Desktop/Gemini - No Way Out.mp3", 'rb'), :file_hash => 'mt_6f32a8110e74e0e033c5cdcad8d59f09', :file_name => 'Gemini - No Way Out.mp3', :api_token => "XFDEDCMWEDRXFQIILAOMIVRVPQLUQXST"

puts r.inspect