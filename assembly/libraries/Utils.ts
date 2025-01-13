import {
  Address,
  call,
  isAddressEoa,
  transferCoins,
} from '@massalabs/massa-as-sdk';
import { u256 } from 'as-bignum/assembly/integer/u256';
import { SafeMath } from './SafeMath';
import { Args } from '@massalabs/as-types';
import { Storage__NotEnoughCoinsSent } from './Errors';
import { IERC20, IPair } from '../interfaces';

export class Amounts {
  constructor(
    public amount0: u256,
    public amount1: u256,
  ) {}
}

export class DeployReturn {
  constructor(
    public pair: IPair,
    public token: IERC20,
  ) {}
}

export const EVENT_DELIMITER = ';?!';
// used to separate elements in a string (e.g. Storage key/value)
export const DELIMITER = ':';

export function createKey(args: string[]): string {
  return args.join(DELIMITER);
}

/**
 * @notice Overrides Massa default createEvent function (use a custom delimiter to avoid collisions)
 *
 * Constructs a pretty formatted event with given key and arguments.
 *
 * @remarks
 * The result is meant to be used with the {@link generateEvent} function.
 * It is useful to generate events from an array.
 *
 * @param key - the string event key.
 *
 * @param args - the string array arguments.
 *
 * @returns the stringified event.
 *
 */
export function createEvent(key: string, args: Array<string>): string {
  return `${key}:`.concat(args.join(EVENT_DELIMITER));
}

/**
 * @notice Function to convert a u256 to a UTF-16 bytes then to a string
 * @dev u256.toString() is too expensive in as-bignum so we use this instead
 */
export function u256ToString(u: u256): string {
  return String.UTF16.decode(changetype<ArrayBuffer>(u));
}

/**
 * @notice Function to transfer remaining Massa coins to a recipient at the end of a call
 * @param balanceInit Initial balance of the SC (transferred coins + balance of the SC)
 * @param balanceFinal Balance of the SC at the end of the call
 * @param sent Number of coins sent to the SC
 * @param to Caller of the function to transfer the remaining coins to
 */
export function transferRemaining(
  balanceInit: u64,
  balanceFinal: u64,
  sent: u64,
  to: Address,
): void {
  if (balanceInit >= balanceFinal) {
    // Some operation might spend Massa by creating new storage space
    const spent = SafeMath.sub(balanceInit, balanceFinal);
    assert(spent <= sent, Storage__NotEnoughCoinsSent(spent, sent));
    if (spent < sent) {
      // SafeMath not needed as spent is always less than sent
      const remaining: u64 = sent - spent;
      _transferRemaining(to, remaining);
    }
  } else {
    // Some operation might unlock Massa by deleting storage space
    const received = SafeMath.sub(balanceFinal, balanceInit);
    const totalToSend: u64 = SafeMath.add(sent, received);
    _transferRemaining(to, totalToSend);
  }
}

function _transferRemaining(to: Address, value: u64): void {
  if (isAddressEoa(to.toString())) transferCoins(to, value);
  else call(to, 'receiveCoins', new Args(), value);
}
