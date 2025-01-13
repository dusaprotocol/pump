import { Args, bytesToU64, u64ToBytes } from '@massalabs/as-types';
import {
  DEPOSIT_TOKEN,
  LAST_UPDATE_TIMESTAMP,
  REWARD_PER_TOKEN,
  REWARD_RATE,
  REWARD_TOKEN,
  TOTAL_STAKED_AMOUNT,
  constructor,
  deposit,
  getPendingRewards,
  getTotalStakedAmount,
  getUserStakedAmount,
} from '../contracts/staking';
import {
  Address,
  Context,
  Storage,
  changeCallStack,
  generateEvent,
  mockAdminContext,
  mockScCall,
  resetStorage,
} from '@massalabs/massa-as-sdk';
import { IERC20 } from '../interfaces/IERC20';

describe('MasterChef', () => {
  beforeEach(() => {
    resetStorage();
    mockAdminContext(true);
    const args = new Args()
      .add('TOKEN_1')
      .add('TOKEN_2')
      .add(u64(1))
      .serialize();
    constructor(args);
    mockAdminContext(false);
  });

  it('Should be correctly initialized', () => {
    const totalStakedAmount = bytesToU64(Storage.get(TOTAL_STAKED_AMOUNT));
    expect(totalStakedAmount).toBe(0);

    const rewardRate = bytesToU64(Storage.get(REWARD_RATE));
    expect(rewardRate).toBe(1);

    const rewardPerToken = bytesToU64(Storage.get(REWARD_PER_TOKEN));
    expect(rewardPerToken).toBe(0);

    const depositToken = new IERC20(new Address(Storage.get(DEPOSIT_TOKEN)));
    expect(depositToken._origin.toString()).toBe('TOKEN_1');

    const rewardToken = new IERC20(new Address(Storage.get(REWARD_TOKEN)));
    expect(rewardToken._origin.toString()).toBe('TOKEN_2');
  });
  it('Should be able to deposit', () => {
    const caller = Context.caller();
    const args = new Args().add(caller).serialize();

    const stakedBefore = getUserStakedAmount(args);
    expect(bytesToU64(stakedBefore)).toBe(0);
    const pendingBefore = getPendingRewards(args);
    expect(bytesToU64(pendingBefore)).toBe(0);

    // mock timestamp to 1 min ago
    const oneMinAgo = Context.timestamp() - 60_000;
    Storage.set(LAST_UPDATE_TIMESTAMP, u64ToBytes(oneMinAgo));

    // stake 1 token
    mockScCall([]); // mock depositToken transferFrom
    deposit(new Args().add(u64(1)).serialize());

    const stakedAfter = getUserStakedAmount(args);
    expect(bytesToU64(stakedAfter)).toBe(1);
    const pendingAfter = getPendingRewards(args);
    expect(bytesToU64(pendingAfter)).toBe(60);
  });
  it('Should calculate rewards correctly with multiple deposits', () => {
    const user1 = generateDumbAddress();
    const user2 = generateDumbAddress();

    // mock timestamp to 1 min ago
    const oneMinAgo = Context.timestamp() - 60_000;
    Storage.set(LAST_UPDATE_TIMESTAMP, u64ToBytes(oneMinAgo));

    // stake 1 token with user1
    setCaller(user1);
    mockScCall([]); // mock depositToken transferFrom
    deposit(new Args().add(u64(1)).serialize());

    // stake 2 tokens with user2 30 seconds later
    setCaller(user2);
    Storage.set(LAST_UPDATE_TIMESTAMP, u64ToBytes(oneMinAgo + 30_000));
    mockScCall([]); // mock depositToken transferFrom
    deposit(new Args().add(u64(2)).serialize());

    const totalStaked = getTotalStakedAmount([]);
    expect(bytesToU64(totalStaked)).toBe(3);
    const pendingUser1 = getPendingRewards(new Args().add(user1).serialize());
    expect(bytesToU64(pendingUser1)).toBe(30);
    const pendingUser2 = getPendingRewards(new Args().add(user2).serialize());
    expect(bytesToU64(pendingUser2)).toBe(30);
  });
});

// ==================================================== //
// ====                 HELPERS                    ==== //
// ==================================================== //

function getCallStack(): string[] {
  return Context.addressStack().map<string>((a) => a.toString());
}

function setCaller(address: string): void {
  const currentStack = getCallStack();
  const newStack = insertAfter(currentStack, 1, address);
  changeCallStack(newStack.join(' , '));
}

function insertAfter<T>(arr: T[], index: i32, value: T): T[] {
  const len = arr.length + 1;
  const res = new Array<T>(len);
  if (index < 0) index = len + index - 1;
  if (index > len) index = len - 1;
  let i = 0;
  while (i < index) res[i] = arr[i++]; // or use memory.copy
  res[i++] = value;
  while (i < len) res[i] = arr[i++ - 1]; // or use memory.copy
  return res;
}

function printCallStack(): void {
  const stack = getCallStack();
  generateEvent(stack.join(' , '));
}

function mixRandomChars(length: i32): string {
  let result = '';
  let characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(
      i32(Math.floor(Math.random() * f64(charactersLength))),
    );
  }
  return result;
}

function generateDumbAddress(): string {
  return 'A12' + mixRandomChars(47);
}
