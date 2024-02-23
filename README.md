# chess-evolutionary-algo

♟️ An evolutionary algorithm to help me learn how to play chess better.

## Abstract

Neural networks are the most popular method for developing modern chess bots. [Stockfish](<https://en.wikipedia.org/wiki/Stockfish_(chess)>) and [AlphaZero](https://en.wikipedia.org/wiki/AlphaZero), some of the strongest chess bots currently known, rely on [neural networks](https://en.wikipedia.org/wiki/Neural_network) and the [Monte Carlo search tree](https://en.wikipedia.org/wiki/Monte_Carlo_tree_search). The problem with this approach is I can't reverse engineer why the computer made a particular move. These AI systems are a "[black box](https://umdearborn.edu/news/ais-mysterious-black-box-problem-explained)".

By contrast, [evolutionary algorithms](https://en.wikipedia.org/wiki/Evolutionary_algorithm) can generate an output we can more easily reverse engineer or visualize. In the case of this specific project, I'm evolving a mathematical equation which evaluates what chess move to make.

While evolutionary algorithms are different from neural networks in a number of important aspects, evolutionary algorithms still rely on the concept of "training" the computer to search a problem space for an optimal solution.

## Local Development

Install [Node Version Manager](https://github.com/nvm-sh/nvm).

```sh
$ nvm install && nvm use
$ npm ci

# Run engine tests
$ npm test -w @chess-evolutionary-algo/pattern-engine
```

If you need to debug chess boards with fen syntax, use the [lichess chess editor](https://lichess.org/editor/). You can import a pgn [here](https://lichess.org/paste).

## Running In The Cloud

I've included a [Terraform](https://developer.hashicorp.com/terraform/intro) file that will deploy this project to [Digital Ocean](https://www.digitalocean.com/).

First, install Terraform CLI,

```sh
$ brew tap hashicorp/tap
$ brew install hashicorp/tap/terraform
```

Copy the example `.env` file and fill out the values. See the inline comments on how to fill out the different values.

```sh
$ cp .env.example .env
```

Finally, create the infrastructure,

```sh
$ cd terraform
$ terraform init

# If you want to preview what is being created
$ terraform plan

$ terraform apply
```

By default, this will create three `s-4vcpu-8gb` vm's in the `nyc3` region, which are `$0.07143`/hour (`~$48`/month). If you want to change these defaults, you can supply the following arguments when running terraform,

```sh
$ terraform apply -var machine_count="3" -var machine_count="s-4vcpu-8gb"
```

To get a list of possible droplet sizes, run the following command,

```sh
$ doctl compute size list
```

When you're done experimenting, run the following the delete your infrastructure resources,

```sh
$ terraform destroy
```

## Contributing

I am not actively seeking contributions to this repository, but feel free to fork it and make your own changes.

This project is [MIT Licensed](./LICENSE).
