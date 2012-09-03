class Playlist
  include DataMapper::Resource
  
  property :id, Serial
  
  property :name, String, length: 0..255

  has n, :playlist_tracks
  has n, :library_tracks, :through => :playlist_tracks
end