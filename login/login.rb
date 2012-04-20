class Login
  @username=@password=@computer_name=""

  @create_user_uri=URI("#{@@mothership}/create_user")
  @login_user_uri=URI("#{@@mothership}/login_user")
  @username_available_uri=URI("#{@@mothership}/username_available")
  @computer_name_available_uri=URI("#{@@mothership}/computer_name_available")
  @check_api_token_uri=URI("#{@@mothership}/check_api_token")

  class << self

    def ensure_computer_name!
      if @@preferences.computer_name.nil? || @@preferences.computer_name == "" || @@preferences.computer_name.length < 5
        @computer_name = ask "Looks like this is the first time you are starting Muusio... You better give your computer a unique, special name :)"
        @computer_name = ask "Try again!" while !computer_name_valid?

        @@preferences.computer_name = @computer_name
        @@preferences.save

        puts "Thanks!"
      end
    end

    def authenticate!
      if !@@preferences.api_token
        response = nil
        response = ask "Welcome! Are you a [N]ew user, or do you wish to [L]ogin? ([Q] to quit)" while(response != 'N' && response != 'L' && response != 'Q')

        if response == 'L'
          puts "Welcome Back!"
          return login
        elsif response == 'N'
          puts "Kewl stuff! Lets get started."
          return create
        else
          abort("Goodbye... Sweet prince...")
        end 
      else
        puts "Logging you in... Please wait..."
        if !check_api_token?
          @@preferences.api_token=nil
          @@preferences.save
          authenticate!
        else
          puts "Welcome back, #{@@preferences.username}!"
        end
      end
    end

    def login
      @username = ask "Username?"
      @password = ask("Password?"){|q| q.echo = false}

      if !@@preferences.computer_name
        @computer_name = ask "Oh, and what is the name of this computer?"
        @@preferences.computer_name = @computer_name
        @@preferences.save
      end

      login if !login_user?
    end

    def login_user?
      begin
        @username.strip!
        @password.strip!
        @computer_name.strip!

        res = Net::HTTP.post_form(@login_user_uri, 'username' => @username, 'password' => @password, 'computer_name' => @@preferences.computer_name)
        response = JSON.parse(res.body)

        if !response['result']
          puts "SERVER: " + "Invalid username or password..."
          return false
        end
      rescue
        puts "Problem with the server... Sure your internets are at full power?"
        return false
      end

      @@preferences.username = @username
      @@preferences.api_token = response['api_token']
      @@preferences.user_id = response['user_id']
      @@preferences.save

      puts "Login Succesful!"
      return true
    end

    def check_api_token?
      return true if @@assume_logged_in
      begin
        res = Net::HTTP.post_form(@check_api_token_uri, 'api_token' => @@preferences.api_token)
        response = JSON.parse(res.body)

        if !response['result']
          puts "SERVER: " + "Your session may have expired!"
          return false
        end
      rescue
        puts "Problem with the server... Sure your internets are at full power?"
        return false
      end

      return response['result']
    end

    def create
      @username = ask "What username would you like?"
      @username = ask "Try again" while(!username_valid?)
      @password = ask("Please enter a totally awesome and unique password"){|q| q.echo = false}
      @password = ask("Try again"){|q| q.echo = false} while(!password_valid?)
      if !@@preferences.computer_name
        @computer_name = ask "And finally, a name for this computer. Make it as awesome as you possibly can."
        @computer_name = ask "Try again" while(!computer_name_valid?)
        @@preferences.computer_name
        @@preferences.save
      end
      if !create_user_on_mothership
        puts "Oh dear... lets try again, shall we?"
        self.create
      else
        puts "Looks like everything went according to plan. Booting up the particle accelerator engines and starting the servers..."
        return true
      end
    end

    def create_user_on_mothership
      puts "Attempting to create your profile on the mothership..."

      begin
        @username.strip!
        @password.strip!
        @computer_name.strip!

        res = Net::HTTP.post_form(@create_user_uri, 'username' => @username, 'password' => @password, 'computer_name' => @@preferences.computer_name)
        response = JSON.parse(res.body)

        if !response['result']
          puts "SERVER: " + response['message'].to_s
          return false
        end
      rescue
        puts "Problem with the server... Sure your internets are at full power?"
        return false
      end

      @@preferences.username = @username
      @@preferences.api_token = response['api_token']
      @@preferences.user_id = response['user_id']
      @@preferences.save

      return true
    end

    def username_valid?(username=nil)
      @username = username if username

      if @username.length < 5

        puts "Username too short (minimum 5 characters), please try again" 
        return false 
      elsif !@username.match(/\A([^@\s]+)@((?:[-a-z0-9]+\.)+[a-z]{2,})\Z/i)

        puts "Username must be a valid email address. Please try again." 
        return false
      else

        puts "Checking username availability..."

        begin

          res = Net::HTTP.post_form(@username_available_uri, 'username' => @username)
          response = JSON.parse(res.body)

          if response['result'] == false

            puts "SERVER: " + response['message'] 
            return false
          end
        rescue
          puts "Problem with the server... Sure your internets are at full power?"
          return false
        end
      end

      puts "Username checks out, d00d."
      true
    end

    def password_valid?(password=nil)
      @password = password if password

      if @password.length < 5

        puts "For gods sake it is a password, make it at least 5 characters long." 
        return false 
      end

      if ask("One more time, to make sure you got it right..."){|q| q.echo = false} != @password

        puts "Password mismatch. Please try again." 
        return false 
      end

      return true
    end

    def computer_name_valid?(computer_name=nil)
      @computer_name = computer_name if computer_name

      if @computer_name.length < 5

        puts "Computer Name too short (minimum 5 characters), please try again."
        return false 
      end

      puts "Checking that your computer name has not been taken..."

      begin
        res = Net::HTTP.post_form(@computer_name_available_uri, 'computer_name' => @computer_name)
        response = JSON.parse(res.body)
        if response['result'] == false
          puts "SERVER: " + response['message']
          return false
        end
      rescue
        puts "Problem with the server... Sure your internets are at full power?"
        return false
      end

      puts "#{@computer_name} checks out. Good work."
      true
    end

    def hello!
      puts "                __                             ___            _aaaa"
      puts "               d8888aa,_                    a8888888a   __a88888888b"
      puts "              d8P   `Y88ba.                a8P'~~~~Y88a888P""~~~~Y88b"
      puts "             d8P      ~\"Y88a____aaaaa_____a8P        888          Y88"
      puts "            d8P          ~Y88\"8~~~~~~~88888P          88g          88"
      puts "           d8P                           88      ____ _88y__       88b"
      puts "           88                           a88    _a88~8888\"8M88a_____888"
      puts "           88                           88P    88  a8\"'     `888888888b_"
      puts "          a8P                           88     88 a88         88b     Y8,"
      puts "           8b                           88      8888P         388      88b"
      puts "          a88a                          Y8b       88L         8888.    88P"
      puts "         a8P                             Y8_     _888       _a8P 88   a88"
      puts "        _8P                               ~Y88a888~888g_   a888yg8'  a88'"
      puts "        88                                   ~~~~    ~\"\"8888        a88P"
      puts "       d8\                                                Y8,      888L"
      puts "       8E                                                  88a___a8\"888"
      puts "      d8P                                                   ~Y888\"   88L"
      puts "      88                                                      ~~      88"
      puts "      88                                                              88"
      puts "      88                                                              88b"
      puts "  ____88a_.      a8a                                                __881"
      puts "88""P~888        888b                                 __          8888888888"
      puts "      888        888P                                d88b             88"
      puts "     _888ba       ~            aaaa.                 8888            d8P"
      puts " a888~\"Y88                    888888                 \"8P          8aa888_"
      puts "        Y8b                   Y888P\"                                88\"\"888a"
      puts "        _88g8                  ~~~                                 a88    ~~"
      puts "    __a8\"888_                                                  a_ a88"
      puts "   88\"'    \"88g                                                 \"888g_"
      puts "   ~         `88a_                                            _a88'\"Y88gg,"
      puts "                \"888aa_.                                   _a88\"'      ~88"
      puts "                   ~~""8888aaa______                ____a888P'"
      puts "                           ~~""""""888888888888888888""~~~"
      puts "                                      ~~~~~~~~~~~~"
      puts ""
    end
  end
end