import { Args, SafeMath } from '@massalabs/as-types';
import { Address, call } from '@massalabs/massa-as-sdk';
import { IPair } from './IPair';
import { DeployReturn } from '../libraries';
import { IERC20 } from './IERC20';

export class IDeployer {
  _origin: Address;

  constructor(_origin: Address) {
    this._origin = _origin;
  }

  init(factory: Address): StaticArray<u8> {
    const args = new Args().add(factory);
    return call(this._origin, 'constructor', args, 0);
  }

  /**
   * Creates a new pair for tokenA and tokenB.
   *
   * @param {Address} tokenA - The address of the first token.
   * @param {Address} tokenB - The address of the second token.
   * @param {u64} amountForFee - The amount of coins to transfer to the pair for storage fee.
   * @param {u64} amountForBuy - The amount of MAS to send for buy.
   * @returns {Address} - The address of the created pair.
   */
  deploy(
    name: string,
    symbol: string,
    amountForFee: u64,
    amountForBuy: u64 = 0,
  ): DeployReturn {
    const args = new Args().add(name).add(symbol).add(amountForBuy);
    const amount = SafeMath.add(amountForFee, amountForBuy);
    const res = new Args(call(this._origin, 'deploy', args, amount));
    return new DeployReturn(
      new IPair(new Address(res.nextString().unwrap())),
      new IERC20(new Address(res.nextString().unwrap())),
    );
  }

  migratePool(pair: Address): void {
    call(this._origin, 'migratePool', new Args().add(pair), 0);
  }
}
