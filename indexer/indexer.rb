require 'mp3info'
# require 'fssm'
require_relative 'filesystemwatcher/filesystemwatcher'

class Indexer
  @bp = File.expand_path File.dirname(__FILE__)
  @received_dir = @bp + "/mp3"

  @file_changes_thread=nil
  @send_files_thread=nil
  @send_ping_pong_thread=nil
  @send_file_list_thread=nil
  @listen_for_file_changes_thread=nil

  @file_monitor_threads={}

  @files=[]
  @changes=[]

  class << self
    def files; @files; end
    def changes; @changes; end
    def received_dir; @received_dir; end

    def run!
      @create_file_list=Thread.new{
        create_file_list
        self.kill
      }

      WatchedFolder.all.each do |wf|
        if File.directory?(wf.path)
          listen_for_file_changes wf.path
        else
          puts "#{wf.path} does not exist, removing from indexer..." if @@logging
          wf.destroy
        end
      end
    end

    def add_file(file)
      begin
        mp3 = Mp3Info.open(file)
      rescue => e
        puts e.inspect if @@logging
      end

      LibraryTrack.create({
        filename: File.basename(file),
        path: File.dirname(file),
        fullpath: file,
        file_hash: "mt_"+Digest::MD5.hexdigest(File.read(file)),
        size: File.size(file),
        duration: mp3 ? (mp3.length.to_i * 1000).to_s : 0, #ms
        id3: {
          title: mp3 && mp3.tag.title ? mp3.tag.title : File.basename(file),
          artist: mp3 ? mp3.tag.artist : '',
          album: mp3 ? mp3.tag.album : '',
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
      WatchedFolder.all.each do |wf|
        folder_files = folder_files + Dir.glob(wf.path + "/**/*.mp3")
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
          # else
          #   puts 'Already in library: '+file if @@logging
          end
        end

        puts "Done re-indexing!" if @@logging
      else
        puts "LibraryTracks == File glob, no need to re-index!"
      end
    end

    def listen_for_file_changes(dir)
      @file_monitor_threads[dir] = Thread.new{
        watcher = FileSystemWatcher.new

        watcher.addDirectory(dir, "**/*.mp3")
        watcher.sleepTime = 10

        watcher.start { |status,file|
          if(status == FileSystemWatcher::CREATED) then
              puts "created: #{file}" if @@logging
              self.add_file file if LibraryTrack.count(:fullpath=>file) == 0
          elsif(status == FileSystemWatcher::MODIFIED) then
              puts "modified: #{file}" if @@logging
              self.delete_file file
              self.add_file file if LibraryTrack.count(:fullpath=>file) == 0
          elsif(status == FileSystemWatcher::DELETED) then
              puts "deleted: #{file}" if @@logging
              self.delete_file file
          end
        }

        puts "Watching #{dir} for changes...\n" if @@logging
      }
    end
  end
end