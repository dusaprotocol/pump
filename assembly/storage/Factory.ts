import { stringToBytes } from '@massalabs/as-types/assembly/serialization/strings';
import { PersistentMap } from '../libraries/PersistentMap';

export const ALL_PAIRS_KEY = stringToBytes('allPairs');
export const PAIRS = new PersistentMap<string, string>('pairMapping');
export const WMAS = 'wmas';
export const DEPLOYER = 'deployer';
export const VIRTUAL_LIQUIDITY_MAS = stringToBytes('vlMas');
export const VIRTUAL_LIQUIDITY_TOKEN = stringToBytes('vlToken');
