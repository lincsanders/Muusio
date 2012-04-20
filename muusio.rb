require 'rubygems'
require 'sinatra/base'
require 'json'
require 'fssm'
require 'thread'
require 'highline/import'
require 'net/http'

# For debug
require 'pp'

@@logging = @@assume_logged_in = false

ARGV.each do|a|
  @@logging = true if a=="--logging" || a=="-l"
  @@assume_logged_in = true if a=="--aassume-logged-in" || a=="-a"
end

# @@mothership="http://localhost:3000"
@@mothership="http://muusio-mothership.herokuapp.com"

require_relative 'indexer/indexer'
require_relative 'downloader/downloader'
require_relative 'login/login'
require_relative 'server/server'
require_relative 'db/db'

Db.run!

@@preferences=Preferences.first

#Login.hello!
Login.ensure_computer_name!
Login.authenticate!

Indexer.run!
Downloader.run!
Server.run!

puts ""
puts "Goodbye!"