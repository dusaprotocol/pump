import { Address } from '@massalabs/massa-as-sdk';
import { u256 } from 'as-bignum/assembly/integer/u256';
import { IFactory } from '../interfaces';
import { Amounts } from './Utils';
import { SafeMath256 } from './SafeMath';

export class DuserPumpLibrary {
  // Fetches the reserves for a pair
  static getReserves(
    factory: IFactory,
    tokenA: Address,
    tokenB: Address,
  ): Amounts {
    const pair = factory.getPair(tokenA, tokenB);
    const reserves = pair.getReserves();
    return new Amounts(reserves.amount0, reserves.amount1);
  }

  // Given some amount of an asset and pair reserves, returns an equivalent amount of the other asset
  static quote(amountA: u256, reserveA: u256, reserveB: u256): u256 {
    assert(amountA > u256.Zero, 'DUSER_PUMP: INSUFFICIENT_AMOUNT');
    assert(
      reserveA > u256.Zero && reserveB > u256.Zero,
      'DUSER_PUMP: INSUFFICIENT_LIQUIDITY',
    );
    return u256.div(SafeMath256.mul(amountA, reserveB), reserveA);
  }

  // Given an input amount of an asset and pair reserves, returns the maximum output amount of the other asset
  static getAmountOut(amountIn: u256, reserveIn: u256, reserveOut: u256): u256 {
    assert(amountIn > u256.Zero, 'DUSER_PUMP: INSUFFICIENT_INPUT_AMOUNT');
    assert(
      reserveIn > u256.Zero && reserveOut > u256.Zero,
      'DUSER_PUMP: INSUFFICIENT_LIQUIDITY',
    );
    const amountInWithFee = SafeMath256.mul(amountIn, u256.fromU32(990));
    const numerator = SafeMath256.mul(amountInWithFee, reserveOut);
    const denominator = SafeMath256.add(
      SafeMath256.mul(reserveIn, u256.fromU32(1000)),
      amountInWithFee,
    );
    return SafeMath256.div(numerator, denominator);
  }

  static getAmountWithoutFee(
    amountIn: u256,
    reserveIn: u256,
    reserveOut: u256,
  ): u256 {
    const numerator = SafeMath256.mul(amountIn, reserveOut);
    const denominator = SafeMath256.add(reserveIn, amountIn);
    return SafeMath256.div(numerator, denominator);
  }

  // Given an output amount of an asset and pair reserves, returns a required input amount of the other asset
  static getAmountIn(amountOut: u256, reserveIn: u256, reserveOut: u256): u256 {
    assert(amountOut > u256.Zero, 'DUSER_PUMP: INSUFFICIENT_OUTPUT_AMOUNT');
    assert(
      reserveIn > u256.Zero && reserveOut > u256.Zero,
      'DUSER_PUMP: INSUFFICIENT_LIQUIDITY',
    );
    const numerator = SafeMath256.mul(
      SafeMath256.mul(reserveIn, amountOut),
      u256.fromU32(1000),
    );
    const denominator = SafeMath256.mul(
      SafeMath256.sub(reserveOut, amountOut),
      u256.fromU32(990),
    );
    return SafeMath256.add(SafeMath256.div(numerator, denominator), u256.One);
  }
}
