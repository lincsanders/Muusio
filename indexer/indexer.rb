class Indexer

	@file_changes_thread=nil
	@send_files_thread=nil
	@send_ping_pong_thread=nil

	class << self
		def run!
			send_file_list
			@listen_for_file_changes=Thread.new{listen_for_file_changes}
			@send_file_changes=Thread.new{send_file_changes}
			@send_ping_pong=Thread.new{send_ping_pong}
		end
		
		def send_file_list
			Dir.glob("./mp3/**.mp3") do |file|
				size=File.size(file)
				name=File.basename(file)
				hash=Digest::MD5.hexdigest(File.read(file))
				@@files << {
					name: name,
					hash: hash,
					size: size,
				}
			end
		end

		def send_file_changes
			## Check changes and make sure create and delete is not really just a name change
			while true do
				#pp @@changes
				#puts "Checking changes and sending em off to webserver"
				sleep 0.4
			end
		end

		def listen_for_file_changes
			puts "Starting monitoring on file system..."
			FSSM.monitor('./mp3', '**.mp3') do
			  create do |path,file|
			  	path=path.force_encoding("UTF-8")
			  	file=file.force_encoding("UTF-8")
			  	@@changes << {path: path, file: file}
			  	puts "CREATED: #{file} (in #{path})"
			  end
			  
			  update do |path,file|
			  	puts "UPDATED: #{file} (in #{path})"
			  end

			  delete do |path,file|
			  	puts "DELETED: #{file} (in #{path})"
			  end
			end
		end
	end
end