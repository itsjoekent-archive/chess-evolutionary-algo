terraform {
  backend "local" {
    path = "./terraform.tfstate"
  }

  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.0"
    }
  }
}

data "digitalocean_account" "default" {}

locals {
  project = "chess-evolutionary-algo"
  region  = "nyc3"
  source  = "https://github.com/itsjoekent/chess-evolutionary-algo"
}

locals {
  envs = { for tuple in regexall("(.*)=(.*)", file("../.env")) : tuple[0] => tuple[1] }
}

variable "machine_count" {
  type    = number
  default = 3
}

variable "machine_type" {
  type    = string
  default = "s-4vcpu-8gb"
}

provider "digitalocean" {
  token = local.envs["DO_TOKEN"]

  spaces_access_id  = local.envs["DO_SPACES_ACCESS_ID"]
  spaces_secret_key = local.envs["DO_SPACES_SECRET_KEY"]
}

resource "digitalocean_spaces_bucket" "default" {
  name   = "${local.project}-${data.digitalocean_account.default.uuid}"
  region = "nyc3"
}

resource "digitalocean_ssh_key" "default" {
  name       = "${local.project}-ssh-key"
  public_key = file(local.envs["SSH_PUBLIC_KEY_PATH"])
}

resource "digitalocean_droplet" "machines" {
  count = var.machine_count

  image  = "ubuntu-20-04-x64"
  name   = "${local.project}-machine-${count.index + 1}"
  region = local.region
  size   = var.machine_type

  ssh_keys = [
    digitalocean_ssh_key.default.id
  ]

  connection {
    host        = self.ipv4_address
    user        = "root"
    type        = "ssh"
    private_key = sensitive(file(local.envs["SSH_PRIVATE_KEY_PATH"]))
  }

  provisioner "remote-exec" {
    inline = [
      "export PATH=$PATH:/usr/bin",
      "export DO_SPACES_NAME=${digitalocean_spaces_bucket.default.name}",
      "export DO_SPACES_REGION=${digitalocean_spaces_bucket.default.region}",
      "export DO_SPACES_ENDPOINT=https://${digitalocean_spaces_bucket.default.region}.digitaloceanspaces.com",
      "export DO_SPACES_KEY=${local.envs["DO_SPACES_ACCESS_ID"]}",
      "export DO_SPACES_SECRET=${local.envs["DO_SPACES_SECRET_KEY"]}",
      "export MACHINE_NAME=m${count.index + 1}",
      # install node version manager
      "sudo apt update -y",
      "sudo apt install curl -y",
      "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash",
      # install source
      "git clone ${local.source}",
      "cd chess-evolutionary-algo",
      # install node & dependencies
      "nvm install && nvm use",
      "npm ci",
      # start runner in background
      "tmux new -d 'npm start -w @chess-evolutionary-algo/runner'"
    ]
  }
}

resource "digitalocean_firewall" "firewall" {
  name = "${local.project}-firewall"

  droplet_ids = [for machine in digitalocean_droplet.machines : machine.id]

  inbound_rule {
    protocol   = "tcp"
    port_range = "22"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol   = "tcp"
    port_range = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol   = "udp"
    port_range = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol = "icmp"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}

resource "digitalocean_project" "default" {
  name        = local.project
  description = "Chess evolutionary algorithm training"
  environment = "Development"

  resources = concat([
    for machine in digitalocean_droplet.machines : machine.id
    ], [
    digitalocean_ssh_key.default.id,
    digitalocean_firewall.firewall.id,
    digitalocean_spaces_bucket.default.id,
  ])
}