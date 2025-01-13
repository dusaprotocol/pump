import { u256 } from 'as-bignum/assembly/integer/u256';

export const PRECISION: u256 = u256.from(u64(10 ** 18));
export const ONE_COIN: u64 = 10 ** 9;
