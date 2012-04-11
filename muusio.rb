require 'rubygems'
require 'sinatra/base'
require 'data_mapper'
require 'json'
require 'fssm'
require 'thread'
require 'highline/import'

# For debug
require 'pp'

load 'indexer/indexer.rb'
load 'downloader/downloader.rb'
load 'server/server.rb'

@@username = ask "Username: "
@@password = ask "Password: "
@@computer_name = ask "Computer Name: "

@@files=[]
@@changes=[]

Indexer.run!
Downloader.run!
Server.run!