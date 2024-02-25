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

variable "max_node_memory" {
  type    = number
  default = 7500 // 7.5gb in mb
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

  provisioner "file" {
    content = templatefile("../packages/runner/.env.example", {
      DO_SPACES_NAME     = digitalocean_spaces_bucket.default.name
      DO_SPACES_REGION   = digitalocean_spaces_bucket.default.region
      DO_SPACES_ENDPOINT = "https://${digitalocean_spaces_bucket.default.region}.digitaloceanspaces.com"
      DO_SPACES_KEY      = local.envs["DO_SPACES_ACCESS_ID"]
      DO_SPACES_SECRET   = local.envs["DO_SPACES_SECRET_KEY"]
      MACHINE_NAME       = "m${count.index + 1}"
    })
    destination = "/etc/.env.runner"
  }

  provisioner "remote-exec" {
    inline = [
      # install node version manager
      "sudo apt update -y",
      "sudo apt install curl -y",
      "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash",
      ". ~/.bashrc",
      # install source
      "git clone ${local.source}",
      "cd chess-evolutionary-algo",
      # set env variables
      "cp /etc/.env.runner packages/runner/.env",
      # install node & dependencies
      "nvm install && nvm use",
      "npm ci",
      # start runner in background
      "tmux new -d 'NODE_OPTIONS=--max-old-space-size=${var.max_node_memory} npm start -w @chess-evolutionary-algo/runner'"
    ]
  }
}

resource "digitalocean_firewall" "firewall" {
  name = "${local.project}-firewall"

  droplet_ids = [for machine in digitalocean_droplet.machines : machine.id]

  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "tcp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "udp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "icmp"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}

resource "digitalocean_project" "default" {
  name        = local.project
  description = "Chess evolutionary algorithm training"
  environment = "Development"

  resources = concat([
    for machine in digitalocean_droplet.machines : machine.urn
    ], [
    digitalocean_spaces_bucket.default.urn,
  ])
}
