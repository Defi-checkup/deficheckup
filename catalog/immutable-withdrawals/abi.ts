// Read functions from the Sourcify-verified migration implementation, checked on 2026-11-02.
export const abi = [
  {
    name: 'getAssetInfo',
    type: 'function',
    inputs: [
      {
        name: 'assetType',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'assetInfo',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    stateMutability: 'view',
  },
  {
    name: 'getEthKey',
    type: 'function',
    inputs: [
      {
        name: 'ownerKey',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    name: 'getWithdrawalBalance',
    type: 'function',
    inputs: [
      {
        name: 'ownerKey',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'assetId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
] as const;
