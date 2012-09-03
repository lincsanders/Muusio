class PlaylistTrack
  include DataMapper::Resource
  
  property :id, Serial

  belongs_to :library_track
  belongs_to :playlist
end