class WatchedFolder
  include DataMapper::Resource
  
  property :id, Serial
  
  property :path, String, length: 0..500
end