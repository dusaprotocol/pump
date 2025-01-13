import { stringToBytes } from '@massalabs/as-types/assembly/serialization/strings';
import { u128 } from 'as-bignum/assembly/integer/u128';
import { u256 } from 'as-bignum/assembly/integer/u256';

export const maxReserve = u256.from(u128.Max);

export const RESERVE_0 = stringToBytes('reserve0');
export const RESERVE_1 = stringToBytes('reserve1');
export const VIRTUAL_LIQUIDITY_MAS = stringToBytes('vlMas');
export const VIRTUAL_LIQUIDITY_TOKEN = stringToBytes('vlToken');

export const FACTORY = 'factory';
export const TOKEN_0 = 'token0';
export const TOKEN_1 = 'token1';

export const STATUS = stringToBytes('STATUS');
export const LOCKED = stringToBytes('LOCKED');
