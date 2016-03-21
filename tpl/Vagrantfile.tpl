VAGRANTFILE_API_VERSION = "2"

IMPL_DIR = "/home/vagrant/impl"

<% _.forEach(ports, function(port) { %>
if ENV['PORT_<%= port %>_MAPPING'].nil? 
  PORT_<%= port %>_MAPPING = "<%= port %>"
else
  PORT_<%= port %>_MAPPING = ENV['PORT_<%= port %>_MAPPING']
end
<% }); %>

if ENV['VAGRANT_BOX'].nil?
  ENV['VAGRANT_BOX'] = "<%= baseBox %>"
end

Vagrant.require_version ">= 1.6.5"

Vagrant.configure(VAGRANTFILE_API_VERSION) do |config|
  config.vm.box = ENV['VAGRANT_BOX']
  config.vm.box_check_update = true

  <% _.forEach(ports, function(port) { %>
  config.vm.network "forwarded_port", guest: <%= port %>, host: PORT_<%= port %>_MAPPING
  <% }); %>

  config.ssh.forward_agent = true

  #config.vm.synced_folder "./", "/home/vagrant/shared"

  config.vm.provider "virtualbox" do |vm|
    vm.memory = 2048
    vm.cpus = 2
  end

  config.vm.provider "vmware_fusion" do |vm|
    vm.memory = 2048
    vm.cpus = 2
  end

  config.vm.provision :shell do |s|
    s.inline = <<-EOT
      #sudo echo "Europe/Berlin" | sudo tee /etc/timezone
      sudo dpkg-reconfigure -f noninteractive tzdata

      sudo /usr/local/bin/ntpclient -s -h pool.ntp.org

      sudo apt-get update -y

      ssh-keyscan github.com >> ~/.ssh/known_hosts

      mkdir -p #{IMPL_DIR}

      cp -a /vagrant/* #{IMPL_DIR}/
    EOT
    s.privileged = false
  end

  if ENV['USE_DOCKER'] == "true" || ENV['USE_DOCKER'] == "yes"
    config.vm.provision "docker" do |d|
      d.build_image IMPL_DIR, args: "-t impl"
      d.run "impl", args: "<% _.forEach(ports, function(port) { %> -p #{PORT_<%= port %>_MAPPING}:<%= port %><% }); %>"
    end
  else
    config.vm.provision :shell do |s|
      s.inline = <<-EOT
        export NPM_VERSION="3"
        export PM2_VERSION="1"
        #export FOREVER_ROOT="#{IMPL_DIR}/.forever"
        #export FOREVER_VERSION="0.15.1"

        sudo apt-get install -y build-essential curl git libssl-dev man

        git clone https://github.com/creationix/nvm.git ~/.nvm && cd ~/.nvm && git checkout `git describe --abbrev=0 --tags`
        echo "source ~/.nvm/nvm.sh" >> ~/.profile
        source ~/.profile

        nvm install 4
        nvm alias default 4

        npm install npm@$NPM_VERSION -g
        npm install pm2@$PM2_VERSION -g
        #npm install forever@$FOREVER_VERSION -g

        cd #{IMPL_DIR}

        npm run prepare-runtime

        #forever -a -c "npm start" -l forever.log -o out.log -e err.log #{IMPL_DIR}
        #forever start -a -c "npm start" -l forever.log -o out.log -e err.log #{IMPL_DIR}
        pm2 start npm --name "api" -- run start
      EOT
      s.privileged = false
    end
  end
end
