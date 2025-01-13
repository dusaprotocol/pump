import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { deploySC, WalletClient, ISCData } from '@massalabs/massa-sc-deployer';
import {
  Args,
  CHAIN_ID,
  DefaultProviderUrls,
  fromMAS,
  MassaUnits,
  MAX_GAS_DEPLOYMENT,
} from '@massalabs/massa-web3';

dotenv.config();

const publicApi = DefaultProviderUrls.BUILDNET;
const chainId = CHAIN_ID.BuildNet;

const secretKey = process.env.WALLET_SECRET_KEY;
if (!secretKey) throw new Error('Missing WALLET_SECRET_KEY in .env file');

const deployerAccount = await WalletClient.getAccountFromSecretKey(secretKey);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(path.dirname(__filename));

(async () => {
  const res = await deploySC(
    publicApi, // JSON RPC URL
    deployerAccount, // account deploying the smart contract(s)
    [
      {
        data: readFileSync(path.join(__dirname, 'build', 'main.wasm')), // smart contract bytecode
        coins: fromMAS(100), // coins for deployment
        args: new Args(),
      },
    ],
    chainId,
    MassaUnits.oneMassa / 10n, // fees for deployment
    MAX_GAS_DEPLOYMENT, // max gas for deployment
    true, // if true, waits for the first event before returning
  );
  process.exit(0); // terminate the process after deployment(s)
})();
