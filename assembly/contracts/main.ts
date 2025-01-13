import {
  call,
  Context,
  createSC,
  fileToByteArray,
  generateEvent,
  transferCoins,
} from '@massalabs/massa-as-sdk';
import { IFactory, IWMAS } from '../interfaces';
import { ONE_COIN } from '../libraries/Constants';
import { Args } from '@massalabs/as-types';

export function constructor(_: StaticArray<u8>): void {
  main(_);
}

export function main(_: StaticArray<u8>): void {
  const caller = Context.caller();

  // deploy WMAS
  const wmasWasm: StaticArray<u8> = fileToByteArray('build/WMAS.wasm');
  const wmas = new IWMAS(createSC(wmasWasm));
  transferCoins(wmas._origin, 5 * ONE_COIN);
  wmas.init();

  // deploy factory
  const factoryWasm: StaticArray<u8> = fileToByteArray('build/Factory.wasm');
  const factory = new IFactory(createSC(factoryWasm));
  transferCoins(factory._origin, 30 * ONE_COIN);
  factory.init(caller, wmas._origin);

  // deploy deployer
  const deployerWasm: StaticArray<u8> = fileToByteArray('build/deployer.wasm');
  const deployer = createSC(deployerWasm);
  const args = new Args().add(factory._origin);
  call(deployer, 'constructor', args, 30 * ONE_COIN);

  call(factory._origin, 'setDeployer', new Args().add(deployer), 0);

  generateEvent(
    wmas._origin.toString() +
      ' ' +
      factory._origin.toString() +
      ' ' +
      deployer.toString(),
  );
}
