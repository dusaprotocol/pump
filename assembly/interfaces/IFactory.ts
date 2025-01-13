import {
  Args,
  bytesToFixedSizeArray,
  bytesToString,
} from '@massalabs/as-types';
import { Address, call, Storage } from '@massalabs/massa-as-sdk';
import { ALL_PAIRS_KEY, PAIRS } from '../storage/Factory';
import { IPair } from './IPair';
import { createKey } from '../libraries';
import { OWNER_KEY } from '@massalabs/sc-standards/assembly/contracts/utils/ownership-internal';

export class IFactory {
  _origin: Address;

  constructor(_origin: Address) {
    this._origin = _origin;
  }

  init(owner: Address, wmas: Address): StaticArray<u8> {
    const args = new Args().add(owner).add(wmas);
    return call(this._origin, 'constructor', args, 0);
  }

  /**
   * Creates a new pair for tokenA and tokenB.
   *
   * @param {Address} tokenA - The address of the first token.
   * @param {Address} tokenB - The address of the second token.
   * @param {u64} amount - The amount of coins to transfer to the pair for storage fee.
   * @returns {Address} - The address of the created pair.
   */
  createPair(_tokenA: Address, amount: u64): Address {
    const args = new Args().add(_tokenA);
    const res = call(this._origin, 'createPair', args, amount);
    return new Address(bytesToString(res));
  }

  /**
   * Returns the length of the allPairs array.
   *
   * @returns {u32} - The number of pairs.
   */
  allPairsLength(): u32 {
    const allPairs = bytesToFixedSizeArray<string>(
      Storage.getOf(this._origin, ALL_PAIRS_KEY),
    );
    return allPairs.length;
  }

  getPair(tokenA: Address, tokenB: Address): IPair {
    const key = createKey([tokenA.toString(), tokenB.toString()]);

    return new IPair(new Address(PAIRS.getOf(this._origin, key, '')));
  }

  getOwner(): Address {
    return new Address(Storage.getOf(this._origin, OWNER_KEY));
  }
}
