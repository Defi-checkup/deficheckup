import { evmContracts } from '../shared/contracts';
import { lookupPrice, valueAtPrice, isEvmAddress, type Check } from '@deficheckup/engine';

// Aave V2 IncentivesController on Ethereum, read on-chain on 2026-11-01: REWARD_TOKEN() is stkAAVE
// and DISTRIBUTION_END() is 2022-05-22, so rewards stopped growing then. claimRewards() still pays:
// eth_estimateGas from four users with rewards passed.
const INCENTIVES_CONTROLLER = '0xd784927Ff2f95ba542BfC824c8a8a98F3495f6b5';
const STKAAVE = '0x4da27a545c0c5B758a6BA100e3a049001de870f5';

// Measured on 2026-11-01: 169,755 gas for claimRewards([], max, user). Claiming through the app
// passes the user's markets, which costs more for someone with open positions.
const CLAIM_GAS = 170_000n;

// Every aToken and debt token with an incentive index in the controller. Built on 2026-11-01 from
// LendingPool 0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9: getReservesList() (37 reserves), then
// getReserveData() for each, keeping the tokens whose assets(token).index is above zero. The list
// cannot grow: the distribution ended in 2022.
const INCENTIVIZED_TOKENS = [
  '0x3Ed3B47Dd13EC9a98b44e6204A523E766B225811',
  '0x531842cEbbdD378f8ee36D171d6cC9C4fcf475Ec',
  '0x9ff58f4fFB29fA2266Ab25e75e2A8b3503311656',
  '0x9c39809Dec7F95F5e0713634a4D0701329B3b4d2',
  '0x030bA81f1c18d280636F32af80b9AAd02Cf0854e',
  '0xF63B34710400CAd3e044cFfDcAb00a0f32E33eCf',
  '0x5165d24277cD063F5ac44Efd447B27025e888f37',
  '0xB9D7CB55f463405CDfBe4E90a6D2Df01C2B92BF1',
  '0xA361718326c15715591c299427c62086F69923D9',
  '0xbA429f7011c9fa04cDd46a2Da24dc0FF0aC6099c',
  '0x028171bCA77440897B824Ca71D1c56caC55b68A3',
  '0x6C3c78838c761c6Ac7bE9F59fe808ea2A6E4379d',
  '0xa06bC25B5805d5F8d82847D191Cb4Af5A3e873E0',
  '0xc713e5E149D5D0715DcD1c156a020976e7E56B88',
  '0x6C5024Cd4F8A59110119C56f8933403A539555EB',
  '0xdC6a3Ab17299D9C2A412B0e0a4C1f55446AE0817',
  '0x101cc05f4A51C0319f570d5E146a8C625198e636',
  '0x01C0eb1f8c6F1C1bF74ae028697ce7AA2a8b0E92',
  '0xBcca60bB61934080951369a648Fb03DF4F96263C',
  '0x619beb58998eD2278e08620f97007e1116D5D25b',
  '0x8dAE6Cb04688C62d939ed9B68d32Bc62e49970b1',
  '0xD37EE7e4f452C6638c96536e68090De8cBcdb583',
  '0x279AF5b99540c1A3A7E3CDd326e19659401eF99e',
  '0x272F97b7a56a387aE942350bBC7Df5700f8a4576',
  '0xF256CC7847E919FAc9B808cC216cAc87CCF2f47a',
  '0xc9BC48c72154ef3e5425641a3c747242112a46AF',
  '0xB5385132EE8321977FfF44b60cDE9fE9AB0B4e6b',
  '0x2e8F4bdbE3d47d7d7DE490437AeA9915D930F1A3',
  '0xFDb93B3b10936cf81FA59A02A7523B6e2149b2B7',
  '0x6F634c6135D2EBD550000ac92F494F9CB8183dAe',
  '0xd4937682df3C8aEF4FE912A96A74121C0829E664',
  '0xfE8F19B17fFeF0fDbfe2671F248903055AFAA8Ca',
] as const;

const controllerAbi = [
  {
    type: 'function',
    name: 'getRewardsBalance',
    stateMutability: 'view',
    inputs: [
      { name: 'assets', type: 'address[]' },
      { name: 'user', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export const aaveV2RewardsCheck: Check = {
  id: 'aave-v2-rewards',
  name: 'Aave V2 liquidity rewards',
  networks: ['ethereum'],
  category: 'forgotten-position',
  status: { kind: 'open' },
  officialLink: 'https://app.aave.com',
  deadline: null,
  contracts: evmContracts('ethereum', INCENTIVES_CONTROLLER, STKAAVE, ...INCENTIVIZED_TOKENS),
  verifiedOn: '2026-11-01',

  async check(address, ctx) {
    if (!isEvmAddress(address)) {
      return { kind: 'error', reason: 'Not a valid EVM address.' };
    }

    const rewards = await ctx.readContract({
      network: 'ethereum',
      to: INCENTIVES_CONTROLLER,
      abi: controllerAbi,
      functionName: 'getRewardsBalance',
      args: [INCENTIVIZED_TOKENS, address],
    });
    if (typeof rewards !== 'bigint') {
      return { kind: 'error', reason: 'Unexpected response from the Aave incentives controller.' };
    }
    if (rewards === 0n) return { kind: 'nothing' };

    const amount = { raw: rewards, decimals: 18, symbol: 'stkAAVE' };
    const [price, claimCostUsd] = await Promise.all([
      lookupPrice(ctx, 'ethereum', STKAAVE),
      ctx.gasCostUsd('ethereum', CLAIM_GAS),
    ]);

    return {
      kind: 'found',
      findings: [
        {
          title: 'Unclaimed Aave V2 rewards (stkAAVE)',
          network: 'ethereum',
          amount,
          ...valueAtPrice(amount, price),
          claimCostUsd,
          deadline: null,
          heldBy: INCENTIVES_CONTROLLER,
        },
      ],
    };
  },
};
