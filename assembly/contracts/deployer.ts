import {
  Address,
  balance,
  callerHasWriteAccess,
  Context,
  createSC,
  fileToByteArray,
  generateEvent,
  Storage,
  transferCoins,
} from '@massalabs/massa-as-sdk';
import { IERC20, IFactory, IPair } from '../interfaces';
import { ONE_COIN, PRECISION } from '../libraries/Constants';
import { Args } from '@massalabs/as-types';
import { transferRemaining } from '../libraries/Utils';
import {
  _setOwner,
  _onlyOwner,
  _isOwner,
} from '@massalabs/sc-standards/assembly/contracts/utils/ownership-internal';
import { u256 } from 'as-bignum/assembly/integer/u256';

export function constructor(_: StaticArray<u8>): void {
  main(_);
}

const FACTORY = 'factory';
const ADMIN = 'admin';

export function main(bs: StaticArray<u8>): void {
  assert(callerHasWriteAccess(), 'DUSER_PUMP: Already initialized');

  Storage.set(FACTORY, new Args(bs).nextString().expect('factory is required'));
  _setOwner(Context.caller().toString());
  Storage.set(ADMIN, Context.caller().toString());
}

export function deploy(bs: StaticArray<u8>): StaticArray<u8> {
  const SCBalance = balance();
  const sent = Context.transferredCoins();

  const args = new Args(bs);
  const name = args.nextString().expect('name is required');
  const symbol = args.nextString().expect('symbol is required');
  const decimals = u8(18);
  const totalSupply = u256.mul(u256.from(1_000_000_000), PRECISION);
  const buyToken = args.nextU256();
  const buyAmount = buyToken.isOk() ? buyToken.unwrap() : u256.Zero;

  const wasm: StaticArray<u8> = fileToByteArray('build/ERC20.wasm');
  const token = new IERC20(createSC(wasm));
  transferCoins(token._origin, 5 * ONE_COIN);
  token.init(name, symbol, decimals, totalSupply);

  const factory = new IFactory(new Address(Storage.get(FACTORY)));

  const pair = new IPair(factory.createPair(token._origin, 10 * ONE_COIN));

  token.transfer(pair._origin, totalSupply);

  pair.mint(Context.callee(), ONE_COIN);

  if (u256.gt(buyAmount, u256.Zero)) {
    pair.buy(buyAmount, u256.Zero, Context.caller(), Context.timestamp() + 10);
  }

  transferRemaining(SCBalance, balance(), sent, Context.caller());

  return new Args().add(pair._origin).add(token._origin).serialize();
}

export function migratePool(bs: StaticArray<u8>): void {
  _onlyAdmin();

  const args = new Args(bs);
  const pair = new IPair(
    new Address(args.nextString().expect('pair is required')),
  );

  assert(pair.isLocked(), 'DUSER_PUMP: Pool is not locked');

  const IERCPAIR = new IERC20(pair._origin);
  IERCPAIR.transfer(pair._origin, u256.One);
  pair.burn(Context.caller());

  pair.deletePool();
}

export function changeOwner(bs: StaticArray<u8>): void {
  _onlyOwner();

  const newOwner = new Address(
    new Args(bs).nextString().expect('newOwner is required'),
  );
  _setOwner(newOwner.toString());
}

export function setAdmin(bs: StaticArray<u8>): void {
  _onlyOwner();

  const newAdmin = new Address(
    new Args(bs).nextString().expect('newAdmin is required'),
  );
  Storage.set(ADMIN, newAdmin.toString());

  generateEvent('Admin changed to ' + newAdmin.toString());
}

function _onlyAdmin(): void {
  assert(
    _isOwner(Context.caller().toString()) ||
      Context.caller().toString() === Storage.get(ADMIN),
    'DUSER_PUMP: Caller is not the admin',
  );
}

/**
 * @notice Function used by an SC to receive Massa coins
 * @param _ unused
 */
export function receiveCoins(_: StaticArray<u8>): void {}
