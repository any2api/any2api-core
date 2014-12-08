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
        sudo apt-get install -y build-essential curl git libssl-dev man

        git clone https://github.com/creationix/nvm.git ~/.nvm && cd ~/.nvm && git checkout `git describe --abbrev=0 --tags`
        echo "source ~/.nvm/nvm.sh" >> ~/.profile
        source ~/.profile

        nvm install 0.10
        nvm alias default 0.10

        npm install forever -g

        cd #{IMPL_DIR}

        npm run prepare-runtime

        #forever -c "npm start" -l ./forever.log -o ./out.log -e ./err.log .
        forever start -c "npm start" -l ./forever.log -o ./out.log -e ./err.log .
      EOT
      s.privileged = false
    end
  end
end
