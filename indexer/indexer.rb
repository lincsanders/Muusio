require 'mp3info'

class Indexer
  @bp = File.expand_path File.dirname(__FILE__)

  @indexed_directories = [
    @bp + "/mp3/",
    ENV['HOME']+'/Music/iTunes/iTunes Media/Music/',
    ENV['HOME']+'/Music/iTunes/iTunes Media/Podcasts/',
  ]

  @file_changes_thread=nil
  @send_files_thread=nil
  @send_ping_pong_thread=nil
  @send_file_list_thread=nil

  @files=[]
  @changes=[]

  class << self
    def files; @files; end
    def changes; @changes; end

    def run!
      @create_file_list=Thread.new{
        create_file_list
        self.kill
      }

      @listen_for_file_changes=Thread.new{
        @indexed_directories.each do |dir|
          Thread.new{listen_for_file_changes dir}
        end
      }
    end

    def add_file(file)
      mp3 = Mp3Info.open(file)

      LibraryTrack.create({
        filename: File.basename(file),
        path: File.dirname(file),
        fullpath: file,
        file_hash: "mt_"+Digest::MD5.hexdigest(File.read(file)),
        size: File.size(file),
        duration: (mp3.length * 1000).to_s, #ms
        id3: {
          title: mp3.tag.title ? mp3.tag.title : File.basename(file),
          artist: mp3.tag.artist,
          album: mp3.tag.album,
        },
      })
    end

    def delete_file(file)
      if(track = LibraryTrack.all(fullpath: file)).first
        LibraryTrack.all({fullpath: file}).first.destroy
      end
    end
    
    def create_file_list
      folder_files = []
      @indexed_directories.each do |dir|
        folder_files = folder_files + Dir.glob(dir + "**/*.mp3")
      end

      # abort files.sort.inspect
      existing_files = []
      LibraryTrack.all({:order => [:fullpath.desc], :fields => [:fullpath]}).each do |t|
        existing_files << t.fullpath
      end

      if Digest::MD5.hexdigest(folder_files.sort.inspect) != Digest::MD5.hexdigest(existing_files.sort.inspect)
        puts "Librarytracks != File glob, lets re-index!" if @@logging

        puts "Checking existing file references..." if @@logging
        existing_files.each do |file|
          if !File.exist? file
            puts 'File no longer exists, removing reference to: '+file if @@logging
            LibraryTrack.all({fullpath: file}).first.destroy
          end
        end

        puts "" if @@logging
        puts "Checking new file references..." if @@logging
        folder_files.each do |file|
          if LibraryTrack.count(:fullpath=>file) == 0
            add_file file  
            puts 'Added: '+file if @@logging
          else
            puts 'Already in library: '+file if @@logging
          end
        end

        puts "Done re-indexing!" if @@logging
      else
        puts "LibraryTracks == File glob, no need to re-index!"
      end
    end

    def listen_for_file_changes(dir)
      monitor = FSSM::Monitor.new

      puts "Now watching #{dir} for changes..." if @@logging

      monitor.path(dir, '**/*.mp3') do |path|

        path.create do |base,file|
          base=base.force_encoding("UTF-8")
          file=file.force_encoding("UTF-8")

          puts "CREATED: #{file} (in #{base})" if @@logging

          self.add_file "#{base}/#{file}"
        end
        
        path.update do |base,file|
          puts "UPDATED: #{file} (in #{base})" if @@logging
        end

        path.delete do |base,file|
          base=base.force_encoding("UTF-8")
          file=file.force_encoding("UTF-8")

          puts "DELETED: #{file} (in #{base})" if @@logging

          self.delete_file "#{base}/#{file}"
        end
      end
      monitor.run
    end
  end
end