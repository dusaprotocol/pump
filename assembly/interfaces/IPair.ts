import { Args, bytesToU256, byteToBool, NoArg } from '@massalabs/as-types';
import { Address, call, Storage } from '@massalabs/massa-as-sdk';
import { u256 } from 'as-bignum/assembly/integer/u256';
import { Amounts } from '../libraries/Utils';
import { IERC20 } from './IERC20';
import {
  FACTORY,
  LOCKED,
  RESERVE_0,
  RESERVE_1,
  TOKEN_0,
  TOKEN_1,
} from '../storage/Pair';
import { IFactory } from './IFactory';
import { ONE_COIN } from '../libraries/Constants';

export class IPair {
  _origin: Address;

  constructor(_origin: Address) {
    this._origin = _origin;
  }

  init(
    tokenA: Address,
    tokenB: Address,
    virtualLiquidityMas: u256,
    virtualLiquidityToken: u256,
  ): StaticArray<u8> {
    const args = new Args()
      .add(tokenA)
      .add(tokenB)
      .add(virtualLiquidityMas)
      .add(virtualLiquidityToken);
    return call(this._origin, 'constructor', args, 2 * ONE_COIN);
  }

  /**
   * Mint liquidity tokens.
   * This low-level function should be called from a contract which performs important safety checks.
   *
   * @param {Address} to - The address to mint the liquidity tokens to.
   * @param {u64} fee - The fee to be paid for storage.
   * @returns {u256} - The amount of liquidity minted.
   */
  mint(to: Address, fee: u64): u256 {
    const args = new Args().add(to);
    return bytesToU256(call(this._origin, 'mint', args, fee));
  }

  /**
   * Burn liquidity tokens.
   * This low-level function should be called from a contract which performs important safety checks.
   *
   * @param {Address} to - The address to send the underlying assets to.
   * @returns {Amounts} - The amounts of token0 and token1 burned.
   */
  burn(to: Address): Amounts {
    const args = new Args().add(to);
    const res = new Args(call(this._origin, 'burn', args, 0));
    return new Amounts(res.nextU256().unwrap(), res.nextU256().unwrap());
  }

  buy(amountIn: u256, amountOutMin: u256, to: Address, deadline: u64): u256 {
    const args = new Args().add(amountOutMin).add(to).add(deadline);
    return bytesToU256(call(this._origin, 'buy', args, amountIn.toU64()));
  }

  sell(amountIn: u256, amountOutMin: u256, to: Address, deadline: u64): u256 {
    const args = new Args()
      .add(amountIn)
      .add(amountOutMin)
      .add(to)
      .add(deadline);
    return bytesToU256(call(this._origin, 'sell', args, 0));
  }

  token0(): IERC20 {
    return new IERC20(new Address(Storage.getOf(this._origin, TOKEN_0)));
  }

  token1(): IERC20 {
    return new IERC20(new Address(Storage.getOf(this._origin, TOKEN_1)));
  }

  getFactory(): IFactory {
    return new IFactory(new Address(Storage.getOf(this._origin, FACTORY)));
  }

  getReserves(): Amounts {
    return new Amounts(
      bytesToU256(Storage.getOf(this._origin, RESERVE_0)),
      bytesToU256(Storage.getOf(this._origin, RESERVE_1)),
    );
  }

  isLocked(): bool {
    return byteToBool(Storage.getOf(this._origin, LOCKED));
  }

  deletePool(): void {
    call(this._origin, 'deletePool', NoArg, 0);
  }
}
