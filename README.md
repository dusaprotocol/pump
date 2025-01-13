# Pump
💊 Duser Pump contracts

This repository contains the Duser Pump contracts.

- The [Pair](./assembly/contracts/pair.ts) is the contract that contains all the logic of the actual pair for swaps, adds, and removals of liquidity. This contract should never be deployed directly, and the deployer and factory should always be used for that matter.

- The [Factory](./assembly/contracts/factory.ts) is the contract used by the deployer to deploy the different pairs and acts as a registry for all the pairs already created. There are also admin functions to update the parameters of the future created pairs.

- The [deployer](./assembly/contracts/deployer.ts) is the actual token launcher. It is used to create new tokens, their corresponding pair, and to migrate pools to a DEX once the bonding curve is full.

## Build

By default this will build all files in `assembly/contracts` directory.

```shell
npm run build
```

## Deploy a smart contract

Prerequisites :

- You must add a `.env` file at the root of the repository with the following keys set to valid values :
  - WALLET_SECRET_KEY="wallet_secret_key"

These keys will be the ones used by the deployer script to interact with the blockchain.

The following command will build contracts in `assembly/contracts` directory and execute the deployment script
`src/deploy.ts`. This script will deploy on the node specified in the `.env` file.

```shell
npm run deploy
```

You can modify `src/deploy.ts` to change the smart contract being deployed, and to pass arguments to the constructor
function:

- line 31: specify what contract you want to deploy
- line 33: create the `Args` object to pass to the constructor of the contract you want to deploy

When the deployment operation is executed on-chain, the
[constructor](https://github.com/massalabs/massa-sc-toolkit/blob/main/packages/sc-project-initializer/commands/init/assembly/contracts/main.ts#L10)
function of the smart contract being deployed will
be called with the arguments provided in the deployment script.

The deployment script uses [massa-sc-deployer library](https://www.npmjs.com/package/@massalabs/massa-sc-deployer)
to deploy smart contracts.

You can edit this script and use [massa-web3 library](https://www.npmjs.com/package/@massalabs/massa-web3)
to create advanced deployment procedure.

For more information, please visit our ReadTheDocs about
[Massa smart-contract development](https://docs.massa.net/en/latest/web3-dev/smart-contracts.html).

## Unit tests

The test framework documentation is available here: [as-pect docs](https://as-pect.gitbook.io/as-pect)

```shell
npm run test
```

## Format code

```shell
npm run fmt
```
