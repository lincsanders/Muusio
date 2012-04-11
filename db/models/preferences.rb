class Preferences
  include DataMapper::Resource
  
  property :id, Serial
  property :user_id, Integer
  property :username, String
  property :api_token, String
  property :computer_name, String
end