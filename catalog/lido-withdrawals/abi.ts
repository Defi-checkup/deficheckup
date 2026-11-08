// Read functions from the Sourcify-verified source, checked on 2026-11-02.
export const abi = [
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [
      {
        name: '_owner',
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
    name: 'findCheckpointHints',
    type: 'function',
    inputs: [
      {
        name: '_requestIds',
        type: 'uint256[]',
        internalType: 'uint256[]',
      },
      {
        name: '_firstIndex',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: '_lastIndex',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'hintIds',
        type: 'uint256[]',
        internalType: 'uint256[]',
      },
    ],
    stateMutability: 'view',
  },
  {
    name: 'getClaimableEther',
    type: 'function',
    inputs: [
      {
        name: '_requestIds',
        type: 'uint256[]',
        internalType: 'uint256[]',
      },
      {
        name: '_hints',
        type: 'uint256[]',
        internalType: 'uint256[]',
      },
    ],
    outputs: [
      {
        name: 'claimableEthValues',
        type: 'uint256[]',
        internalType: 'uint256[]',
      },
    ],
    stateMutability: 'view',
  },
  {
    name: 'getLastCheckpointIndex',
    type: 'function',
    inputs: [],
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
    name: 'getWithdrawalRequests',
    type: 'function',
    inputs: [
      {
        name: '_owner',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'requestsIds',
        type: 'uint256[]',
        internalType: 'uint256[]',
      },
    ],
    stateMutability: 'view',
  },
  {
    name: 'getWithdrawalStatus',
    type: 'function',
    inputs: [
      {
        name: '_requestIds',
        type: 'uint256[]',
        internalType: 'uint256[]',
      },
    ],
    outputs: [
      {
        name: 'statuses',
        type: 'tuple[]',
        components: [
          {
            name: 'amountOfStETH',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'amountOfShares',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'owner',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'timestamp',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'isFinalized',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'isClaimed',
            type: 'bool',
            internalType: 'bool',
          },
        ],
        internalType: 'struct WithdrawalQueueBase.WithdrawalRequestStatus[]',
      },
    ],
    stateMutability: 'view',
  },
] as const;
