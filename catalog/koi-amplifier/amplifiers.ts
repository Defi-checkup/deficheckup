import type { EvmAddress } from '@deficheckup/engine';

export interface Amplifier {
  /** The Amplifier contract, in full. Staked LP is withdrawn here with withdraw(). */
  amplifier: EvmAddress;
  /** The pool whose LP it holds, in full. Must be one of KOI_LP_POOLS. */
  pair: EvmAddress;
  /** Day the rewards ended (YYYY-MM-DD), read from endTime(). */
  endedOn: string;
}

// Mute Amplifiers on zkSync Era that still held LP on 2026-11-01. Found among the LP holders of the
// 153 Koi pools in KOI_LP_POOLS: every contract whose lpToken() is the pool and that answers
// totalUserStake(address). In all six, totalStake() matched the LP the contract held, and
// totalStakers() added up to 5,220 stakers. Together they held about $125,950 of LP.
export const AMPLIFIERS: readonly Amplifier[] = [
  {
    amplifier: '0x3bdb188cfb6A9173E36A916004144b122eA507cE',
    pair: '0xDFAaB828f5F515E104BaaBa4d8D554DA9096f0e4',
    endedOn: '2023-05-17',
  },
  {
    amplifier: '0xdd3C34aDf2851766DDc302766228d59F43a4386F',
    pair: '0xDFAaB828f5F515E104BaaBa4d8D554DA9096f0e4',
    endedOn: '2023-06-17',
  },
  {
    amplifier: '0xCc05E242b4A82f813a895111bCa072c8BBbA4a0e',
    pair: '0xDFAaB828f5F515E104BaaBa4d8D554DA9096f0e4',
    endedOn: '2023-08-31',
  },
  {
    amplifier: '0x06e8D81f824F8b8758A75Fe9616Dd154400Cb7a4',
    pair: '0xDFAaB828f5F515E104BaaBa4d8D554DA9096f0e4',
    endedOn: '2023-07-19',
  },
  {
    amplifier: '0x0B5d073eA715f38Fde1dE52689CFaB041cC8d278',
    pair: '0x7C21e2e777CecaF969BF7B7AEF0E3Bf23d043672',
    endedOn: '2023-07-21',
  },
  {
    amplifier: '0xBFdD2e0d527A00aA14aAf84ea01a613299aa6908',
    pair: '0x203cc35A44c384a560D6F598dDe33bB0580C0355',
    endedOn: '2023-06-18',
  },
];
