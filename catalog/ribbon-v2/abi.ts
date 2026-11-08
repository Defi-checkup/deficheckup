// Read functions from the Sourcify-verified sources, checked on 2026-11-02.
export const abi = [
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [
      {
        name: 'account',
        type: 'address',
        internalType: 'address',
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
  {
    name: 'depositReceipts',
    type: 'function',
    inputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'round',
        type: 'uint16',
        internalType: 'uint16',
      },
      {
        name: 'amount',
        type: 'uint104',
        internalType: 'uint104',
      },
      {
        name: 'unredeemedShares',
        type: 'uint128',
        internalType: 'uint128',
      },
    ],
    stateMutability: 'view',
  },
  {
    name: 'roundPricePerShare',
    type: 'function',
    inputs: [
      {
        name: '',
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
  {
    name: 'shareBalances',
    type: 'function',
    inputs: [
      {
        name: 'account',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'heldByAccount',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'heldByVault',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    name: 'vaultParams',
    type: 'function',
    inputs: [],
    outputs: [
      {
        name: 'isPut',
        type: 'bool',
        internalType: 'bool',
      },
      {
        name: 'decimals',
        type: 'uint8',
        internalType: 'uint8',
      },
      {
        name: 'asset',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'underlying',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'minimumSupply',
        type: 'uint56',
        internalType: 'uint56',
      },
      {
        name: 'cap',
        type: 'uint104',
        internalType: 'uint104',
      },
    ],
    stateMutability: 'view',
  },
  {
    name: 'vaultPauser',
    type: 'function',
    inputs: [],
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
    name: 'vaultState',
    type: 'function',
    inputs: [],
    outputs: [
      {
        name: 'round',
        type: 'uint16',
        internalType: 'uint16',
      },
      {
        name: 'lockedAmount',
        type: 'uint104',
        internalType: 'uint104',
      },
      {
        name: 'lastLockedAmount',
        type: 'uint104',
        internalType: 'uint104',
      },
      {
        name: 'totalPending',
        type: 'uint128',
        internalType: 'uint128',
      },
      {
        name: 'queuedWithdrawShares',
        type: 'uint128',
        internalType: 'uint128',
      },
    ],
    stateMutability: 'view',
  },
  {
    name: 'withdrawals',
    type: 'function',
    inputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'round',
        type: 'uint16',
        internalType: 'uint16',
      },
      {
        name: 'shares',
        type: 'uint128',
        internalType: 'uint128',
      },
    ],
    stateMutability: 'view',
  },
  {
    name: 'pausedPositions',
    type: 'function',
    inputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'round',
        type: 'uint16',
        internalType: 'uint16',
      },
      {
        name: 'shares',
        type: 'uint128',
        internalType: 'uint128',
      },
    ],
    stateMutability: 'view',
  },
] as const;
