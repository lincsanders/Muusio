class LibraryTrack
  include DataMapper::Resource
  
  property :id, Serial
  
  property :filename, String, length: 0..500
  property :path, String, length: 0..500
  property :fullpath, String, length: 0..500
  property :file_hash, String, length: 0..500
  property :size, Integer
  property :duration, String, length: 0..500
  property :id3, Object
end