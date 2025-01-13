/** ReentrancyGuard errors */

export const ReentrancyGuard__ReentrantCall = (): string =>
  'ReentrancyGuard__ReentrantCall';
export const ReentrancyGuard__AlreadyInitialized = (): string =>
  'ReentrancyGuard__AlreadyInitialized';

/** Storage errors */

export const Storage__NotEnoughCoinsSent = (spent: u64, sent: u64): string =>
  `Storage__NotEnoughCoinsSent: ${spent}, ${sent}`;
