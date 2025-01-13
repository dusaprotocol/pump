import {
  Args,
  boolToByte,
  bytesToU256,
  byteToBool,
  u256ToBytes,
} from '@massalabs/as-types';
import {
  Address,
  balance,
  callerHasWriteAccess,
  Context,
  fileToByteArray,
  generateEvent,
  setBytecode,
  Storage,
  transferCoins,
} from '@massalabs/massa-as-sdk';
import { IERC20, IWMAS } from '../interfaces';
import { u256 } from 'as-bignum/assembly/integer/u256';
import {
  _burn,
  _decreaseTotalSupply,
} from '@massalabs/sc-standards/assembly/contracts/FT/burnable/burn-internal';
import { _mint } from '@massalabs/sc-standards/assembly/contracts/FT/mintable/mint-internal';
import {
  SafeMath256,
  ReentrancyGuard,
  createEvent,
  DuserPumpLibrary,
} from '../libraries';
import { _balance } from '@massalabs/sc-standards/assembly/contracts/FT/token-internals';
import {
  TOTAL_SUPPLY_KEY,
  constructor as _constructor,
} from '@massalabs/sc-standards/assembly/contracts/FT/token';
import {
  FACTORY,
  TOKEN_0,
  TOKEN_1,
  RESERVE_0,
  RESERVE_1,
  maxReserve,
  LOCKED,
  VIRTUAL_LIQUIDITY_MAS,
  VIRTUAL_LIQUIDITY_TOKEN,
} from '../storage/Pair';
import { Amounts, transferRemaining, u256ToString } from '../libraries/Utils';
import { PRECISION } from '../libraries/Constants';

export * from '@massalabs/sc-standards/assembly/contracts/FT/token';

export function constructor(bs: StaticArray<u8>): void {
  assert(callerHasWriteAccess(), 'DUSER_PUMP: PAIR ALREADY INITIALIZED');

  const args = new Args(bs);
  const token0 = new Address(args.nextString().expect('token0 is required'));
  const token1 = new Address(args.nextString().expect('token1 is required'));
  const virtualLiquidityMas = args
    .nextU256()
    .expect('virtualLiquidityMas is required');
  const virtualLiquidityToken = args
    .nextU256()
    .expect('virtualLiquidityToken is required');

  // Cover for wmas storage cost
  new IWMAS(token1).deposit(u64(10_000_000));

  Storage.set(FACTORY, Context.caller().toString());
  Storage.set(TOKEN_0, token0.toString());
  Storage.set(TOKEN_1, token1.toString());
  Storage.set(VIRTUAL_LIQUIDITY_MAS, u256ToBytes(virtualLiquidityMas));
  Storage.set(VIRTUAL_LIQUIDITY_TOKEN, u256ToBytes(virtualLiquidityToken));
  Storage.set(RESERVE_0, u256ToBytes(virtualLiquidityToken));
  Storage.set(RESERVE_1, u256ToBytes(virtualLiquidityMas));
  Storage.set(LOCKED, boolToByte(false));

  _constructor(
    new Args()
      .add(`Duser Pump LP`)
      .add('DUSER_PUMP')
      .add(u8(18))
      .add(u256.Zero)
      .serialize(),
  );

  ReentrancyGuard.__ReentrancyGuard_init();
}

/**
 * Modifier to ensure the deadline has not passed and the pool is not locked.
 *
 * @param {u256} deadline - The deadline timestamp.
 */
function ensure(deadline: u64): void {
  assert(Context.timestamp() <= deadline, 'DUSER_PUMP: EXPIRED');
  assert(!byteToBool(Storage.get(LOCKED)), 'DUSER_PUMP: LOCKED');
}

/**
 * Updates the reserves and price accumulators.
 *
 * @param {u256} balance0 - The new balance of token0.
 * @param {u256} balance1 - The new balance of token1.
 */
function _update(balance0: u256, balance1: u256): void {
  assert(
    balance0 <= maxReserve && balance1 <= maxReserve,
    'DUSER_PUMP: OVERFLOW',
  );

  setReserves(balance0, balance1);

  const event = createEvent('Sync', [
    u256ToString(balance0),
    u256ToString(balance1),
  ]);
  generateEvent(event);
}

/**
 * Mint liquidity tokens.
 * This low-level function should be called from a contract which performs important safety checks.
 *
 * @param {Address} to - The address to mint the liquidity tokens to.
 * @returns {u256} - The amount of liquidity minted.
 */
export function mint(bs: StaticArray<u8>): StaticArray<u8> {
  ReentrancyGuard.nonReentrant();
  const to = new Address(new Args(bs).nextString().expect('to is required'));

  const SCBalance = balance();
  const sent = Context.transferredCoins();

  const reserves = getReserves();
  const _reserve0 = reserves.amount0;
  const _reserve1 = reserves.amount1;

  const token0: IERC20 = getToken0();
  const token1: IERC20 = getToken1();

  const balance0 = u256.add(
    token0.balanceOf(Context.callee()),
    getVirtualLiquidityToken(),
  );
  const balance1 = u256.add(
    token1.balanceOf(Context.callee()),
    getVirtualLiquidityMas(),
  );
  const amount0 = SafeMath256.sub(balance0, _reserve0);
  const amount1 = SafeMath256.sub(balance1, _reserve1);

  const _totalSupply = bytesToU256(Storage.get(TOTAL_SUPPLY_KEY)); // gas savings, must be defined here since totalSupply can update in _mintFee
  assert(_totalSupply.isZero(), 'DUSER_PUMP: ALREADY_MINTED');

  let liquidity: u256 = u256.Zero;

  _mint(new Args().add(to).add(u256.One).serialize());

  _update(balance0, balance1);

  const event = createEvent('Mint', [
    to.toString(),
    u256ToString(amount0),
    u256ToString(amount1),
  ]);
  generateEvent(event);

  transferRemaining(SCBalance, balance(), sent, Context.caller());

  ReentrancyGuard.endNonReentrant();

  return u256ToBytes(liquidity);
}

/**
 * Burn liquidity tokens.
 * This low-level function should be called from a contract which performs important safety checks.
 *
 * @param {Address} to - The address to send the underlying assets to.
 * @returns {StaticArray<u8>} - The amounts of token0 and token1 burned.
 */
export function burn(bs: StaticArray<u8>): StaticArray<u8> {
  ReentrancyGuard.nonReentrant();

  const to = new Address(new Args(bs).nextString().expect('to is required'));
  const callee = Context.callee();

  const token0: IERC20 = getToken0();
  const token1: IERC20 = getToken1();

  const amount0 = token0.balanceOf(Context.callee());
  const amount1 = token1.balanceOf(Context.callee());

  assert(
    _balance(callee) == u256.One,
    'DUSER_PUMP: INSUFFICIENT_LIQUIDITY_SENT',
  );

  _decreaseTotalSupply(u256.One);
  _burn(callee, u256.One);
  generateEvent('BURN SUCCESS');

  token0.transfer(to, amount0);
  token1.transfer(to, amount1);

  _update(u256.Zero, u256.Zero);

  const event = createEvent('Burn', [
    Context.caller().toString(),
    u256ToString(amount0),
    u256ToString(amount1),
    to.toString(),
  ]);
  generateEvent(event);

  ReentrancyGuard.endNonReentrant();

  return new Args().add(amount0).add(amount1).serialize();
}

export function buy(bs: StaticArray<u8>): StaticArray<u8> {
  ReentrancyGuard.nonReentrant();

  const args = new Args(bs);
  let amountOutMin = args.nextU256().expect('amountOutMin is required');
  const to = new Address(args.nextString().expect('to is required'));
  const deadline = args.nextU64().expect('deadline is required');

  const wmas: IWMAS = new IWMAS(getToken1()._origin);
  ensure(deadline);

  let amountMas = Context.transferredCoins();

  let amountOut = DuserPumpLibrary.getAmountOut(
    u256.from(amountMas),
    getReserves().amount1,
    getReserves().amount0,
  );

  if (
    SafeMath256.sub(getToken0().balanceOf(Context.callee()), amountOut) <
    u256.mul(u256.from(200_000_000), PRECISION)
  ) {
    amountOut = SafeMath256.sub(
      getToken0().balanceOf(Context.callee()),
      u256.mul(u256.from(200_000_000), PRECISION),
    );

    amountMas = DuserPumpLibrary.getAmountIn(
      amountOut,
      getReserves().amount1,
      getReserves().amount0,
    ).toU64();

    amountOutMin = u256.div(
      u256.mul(amountOutMin, u256.from(amountMas)),
      u256.from(Context.transferredCoins()),
    ); // Recalculate amountOutMin with the same ratio

    assert(
      amountMas <= Context.transferredCoins(),
      'DUSER_PUMP: EXCESSIVE_INPUT_AMOUNT',
    );
    transferCoins(Context.caller(), Context.transferredCoins() - amountMas);
    Storage.set(LOCKED, boolToByte(true));
  }

  assert(amountOut >= amountOutMin, 'DUSER_PUMP: INSUFFICIENT_OUTPUT_AMOUNT');

  wmas.deposit(amountMas);

  const amountMasFee = SafeMath256.div(u256.from(amountMas), u256.fromU32(100));

  _swap(amountOut, u256.Zero, amountMasFee, to);

  ReentrancyGuard.endNonReentrant();

  return u256ToBytes(amountOut);
}

export function sell(bs: StaticArray<u8>): StaticArray<u8> {
  ReentrancyGuard.nonReentrant();

  const args = new Args(bs);
  const amountIn = args.nextU256().expect('amountIn is required');
  const amountOutMin = args.nextU256().expect('amountOutMin is required');
  const to = new Address(args.nextString().expect('to is required'));
  const deadline = args.nextU64().expect('deadline is required');

  ensure(deadline);

  const amountOut = DuserPumpLibrary.getAmountOut(
    amountIn,
    getReserves().amount0,
    getReserves().amount1,
  );

  assert(amountOut >= amountOutMin, 'DUSER_PUMP: INSUFFICIENT_OUTPUT_AMOUNT');

  const token0: IERC20 = getToken0();
  token0.transferFrom(Context.caller(), Context.callee(), amountIn);

  const amountMasFee = SafeMath256.sub(
    DuserPumpLibrary.getAmountWithoutFee(
      amountIn,
      getReserves().amount0,
      getReserves().amount1,
    ),
    amountOut,
  );

  // swap & withdraw
  _swap(u256.Zero, amountOut, amountMasFee, to);

  ReentrancyGuard.endNonReentrant();

  return u256ToBytes(amountOut);
}

export function deletePool(_: StaticArray<u8>): void {
  // check if it's deployer
  assert(
    Context.caller().toString() ==
      Storage.getOf(new Address(Storage.get(FACTORY)), 'deployer'),
    'NOT DEPLOYER',
  );

  // check if the pool is migrated
  assert(getReserves().amount0.isZero() && getReserves().amount1.isZero());

  const keys = Storage.getKeys();

  for (let i = 0; i < keys.length; i++) {
    Storage.del(keys[i]);
  }

  // delete bytecode
  setBytecode(fileToByteArray('build/empty.wasm'));

  transferCoins(Context.transactionCreator(), balance());
}

/**
 * Swap tokens on a Uniswap V2-like DEX.
 * This function should be called from a contract which performs important safety checks.
 *
 * @param {u256} amount0Out - The amount of token0 to be sent.
 * @param {u256} amount1Out - The amount of token1 to be sent.
 * @param {Address} to - The address to send the tokens to.
 * @param {StaticArray<u8>} data - Additional data to pass to the recipient.
 */
function _swap(
  amount0Out: u256,
  amount1Out: u256,
  amountMasFee: u256,
  to: Address,
): void {
  assert(
    amount0Out > u256.Zero || amount1Out > u256.Zero,
    'DUSER_PUMP: INSUFFICIENT_OUTPUT_AMOUNT',
  );

  const reserves = getReserves();
  const reserve0 = reserves.amount0;
  const reserve1 = reserves.amount1;

  assert(
    amount0Out <= reserve0 &&
      amount1Out <= reserve1 &&
      u256.sub(reserve0, amount0Out) >= getVirtualLiquidityToken() &&
      u256.sub(reserve1, amount1Out) >= getVirtualLiquidityMas(),
    'DUSER_PUMP: INSUFFICIENT_LIQUIDITY',
  );

  const token0: IERC20 = getToken0();
  const token1: IERC20 = getToken1();

  assert(
    to != token0._origin && to != token1._origin,
    'DUSER_PUMP: INVALID_TO',
  );
  if (amount0Out > u256.Zero) token0.transfer(to, amount0Out); // optimistically transfer tokens
  if (amount1Out > u256.Zero)
    new IWMAS(token1._origin).withdraw(amount1Out.toU64(), to); // optimistically transfer tokens

  // Collect Fees
  token1.transfer(new Address(Storage.get(FACTORY)), amountMasFee);

  const balance0 = u256.add(
    token0.balanceOf(Context.callee()),
    getVirtualLiquidityToken(),
  );
  const balance1 = u256.add(
    token1.balanceOf(Context.callee()),
    getVirtualLiquidityMas(),
  );

  const amount0In =
    balance0 > SafeMath256.sub(reserve0, amount0Out)
      ? SafeMath256.sub(balance0, SafeMath256.sub(reserve0, amount0Out))
      : u256.Zero;
  const amount1In =
    balance1 > SafeMath256.sub(reserve1, amount1Out)
      ? SafeMath256.sub(balance1, SafeMath256.sub(reserve1, amount1Out))
      : u256.Zero;

  assert(
    amount0In > u256.Zero || amount1In > u256.Zero,
    'DUSER_PUMP: INSUFFICIENT_INPUT_AMOUNT',
  );

  _update(balance0, balance1);
  const event = createEvent('Swap', [
    Context.caller().toString(),
    u256ToString(amount0In),
    u256ToString(amount1In),
    u256ToString(amount0Out),
    u256ToString(amount1Out),
    to.toString(),
  ]);
  generateEvent(event);
}

/**
 * Get the token that is used as the base currency for the pair
 */
function getToken0(): IERC20 {
  return new IERC20(new Address(Storage.get(TOKEN_0)));
}

/**
 * Get the token that is used as the quote currency for the pair
 */
function getToken1(): IERC20 {
  return new IERC20(new Address(Storage.get(TOKEN_1)));
}

function setReserves(reserve0: u256, reserve1: u256): void {
  Storage.set(RESERVE_0, u256ToBytes(reserve0));
  Storage.set(RESERVE_1, u256ToBytes(reserve1));
}

function getReserves(): Amounts {
  return new Amounts(
    bytesToU256(Storage.get(RESERVE_0)),
    bytesToU256(Storage.get(RESERVE_1)),
  );
}

function getVirtualLiquidityMas(): u256 {
  return bytesToU256(Storage.get(VIRTUAL_LIQUIDITY_MAS));
}

function getVirtualLiquidityToken(): u256 {
  return bytesToU256(Storage.get(VIRTUAL_LIQUIDITY_TOKEN));
}

/**
 * @notice Function used by an SC to receive Massa coins
 * @param _ unused
 */
export function receiveCoins(_: StaticArray<u8>): void {}
