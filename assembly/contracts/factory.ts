import {
  Args,
  bytesToNativeTypeArray,
  bytesToU256,
  nativeTypeArrayToBytes,
  stringToBytes,
  u256ToBytes,
} from '@massalabs/as-types';
import {
  Address,
  balance,
  callerHasWriteAccess,
  Context,
  createSC,
  fileToByteArray,
  generateEvent,
  Storage,
} from '@massalabs/massa-as-sdk';
import { IPair, IERC20 } from '../interfaces';
import {
  ALL_PAIRS_KEY,
  PAIRS,
  WMAS,
  DEPLOYER,
  VIRTUAL_LIQUIDITY_MAS,
  VIRTUAL_LIQUIDITY_TOKEN,
} from '../storage/Factory';
import { createEvent, createKey, transferRemaining } from '../libraries/Utils';
import { u256 } from 'as-bignum/assembly/integer/u256';
import { ONE_COIN, PRECISION } from '../libraries/Constants';
import {
  _onlyOwner,
  _setOwner,
  OWNER_KEY,
} from '@massalabs/sc-standards/assembly/contracts/utils/ownership-internal';

export * from '@massalabs/sc-standards/assembly/contracts/utils/ownership';

/**
 * Initializes the factory with the owner address.
 *
 * @param {Address} owner - The owner address.
 */
export function constructor(bs: StaticArray<u8>): void {
  assert(callerHasWriteAccess(), 'DUSER_PUMP: Already initialized');
  const args = new Args(bs);
  const owner = args.nextString().expect('owner is required');
  const wmas = args.nextString().expect('wmas is required');

  Storage.set(ALL_PAIRS_KEY, nativeTypeArrayToBytes([]));
  Storage.set(
    VIRTUAL_LIQUIDITY_MAS,
    u256ToBytes(u256.mul(u256.from(150_000), u256.from(ONE_COIN))),
  );
  Storage.set(
    VIRTUAL_LIQUIDITY_TOKEN,
    u256ToBytes(u256.mul(u256.from(200_000_000), u256.from(PRECISION))),
  );
  Storage.set(WMAS, wmas);
  _setOwner(owner);
}

/**
 * Creates a new pair for tokenA and tokenB.
 *
 * @param {Address} tokenA - The address of the first token.
 * @param {Address} tokenB - The address of the second token.
 * @returns {Address} - The address of the created pair.
 */
export function createPair(bs: StaticArray<u8>): StaticArray<u8> {
  assert(
    Context.caller() == new Address(Storage.get(DEPLOYER)),
    'DUSER_PUMP: FORBIDDEN',
  );
  const args = new Args(bs);
  const tokenA = new Address(args.nextString().expect('tokenA is required'));
  const wmas = new Address(Storage.get(WMAS));

  const SCBalance = balance();
  const sent = Context.transferredCoins();

  assert(tokenA != wmas, 'DUSER_PUMP: IDENTICAL_ADDRESSES');
  assert(tokenA != new Address(), 'DUSER_PUMP: ZERO_ADDRESS');

  const key = createKey([tokenA.toString(), wmas.toString()]);
  assert(!PAIRS.contains(key), 'DUSER_PUMP: PAIR_EXISTS');

  const bytecode: StaticArray<u8> = fileToByteArray('build/Pair.wasm');
  const pair = new IPair(createSC(bytecode));

  pair.init(
    tokenA,
    wmas,
    bytesToU256(Storage.get(VIRTUAL_LIQUIDITY_MAS)),
    bytesToU256(Storage.get(VIRTUAL_LIQUIDITY_TOKEN)),
  );

  PAIRS.set(key, pair._origin.toString());

  let allPairs = bytesToNativeTypeArray<string>(Storage.get(ALL_PAIRS_KEY));
  allPairs.push(pair._origin.toString());
  Storage.set(ALL_PAIRS_KEY, nativeTypeArrayToBytes(allPairs));

  const event = createEvent('NEW_PAIR', [
    tokenA.toString(),
    wmas.toString(),
    pair._origin.toString(),
    allPairs.length.toString(),
  ]);
  generateEvent(event);

  transferRemaining(SCBalance, balance(), sent, Context.caller());

  return stringToBytes(pair._origin.toString());
}

export function setDeployer(bs: StaticArray<u8>): void {
  _onlyOwner();
  const _deployer = new Address(
    new Args(bs).nextString().expect('_deployer is required'),
  );
  Storage.set(DEPLOYER, _deployer.toString());
}

export function setVirtualLiquidityMas(bs: StaticArray<u8>): void {
  _onlyOwner();
  const _virtualLiquidityMas = bytesToU256(
    new Args(bs).nextBytes().expect('_virtualLiquidity is required'),
  );
  Storage.set(VIRTUAL_LIQUIDITY_MAS, u256ToBytes(_virtualLiquidityMas));
}

export function setVirtualLiquidityToken(bs: StaticArray<u8>): void {
  _onlyOwner();
  const _virtualLiquidityToken = bytesToU256(
    new Args(bs).nextBytes().expect('_virtualLiquidity is required'),
  );
  Storage.set(VIRTUAL_LIQUIDITY_TOKEN, u256ToBytes(_virtualLiquidityToken));
}

export function collectFees(_: StaticArray<u8>): void {
  const wmas = new IERC20(new Address(Storage.get(WMAS)));
  const balance = wmas.balanceOf(Context.callee());
  wmas.transfer(new Address(Storage.get(OWNER_KEY)), balance);
}

/**
 * @notice Function used by an SC to receive Massa coins
 * @param _ unused
 */
export function receiveCoins(_: StaticArray<u8>): void {}
