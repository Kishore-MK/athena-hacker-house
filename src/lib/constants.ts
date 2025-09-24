import { UsdcIcon, MonIcon, WethIcon } from './icons';
import type { ComponentType } from 'react';

export type Token = 'USDC' | 'MON' | 'WETH';

export const TOKENS: { [key in Token]: { name: string; icon: ComponentType<{ className?: string }> } } = {
  USDC: { name: 'USD Coin', icon: UsdcIcon },
  MON: { name: 'MON Protocol', icon: MonIcon },
  WETH: { name: 'Wrapped Ether', icon: WethIcon },
};

export const SWAP_PAIRS: { [key in Token]: Token[] } = {
  USDC: ['MON', 'WETH'],
  MON: ['USDC', 'WETH'],
  WETH: ['USDC', 'MON'],
};

export const GAME_CONFIG = {
  gravity: 0.2,
  launchPower: 0.2,
  groundHeight: 96,
  slingshotPosition: { x: 120, y: 420 },
  maxDragDistance: 80,
  birdSize: { width: 48, height: 48 },
  towerWidth: 120,
  towerHeight: 300,
};

// Real addresses for Monad Testnet from official docs
export const TOKEN_ADDRESSES: Record<Token, `0x${string}`> = {
  USDC: '0xf817257fed379853cDe0fa4F97AB987181B1E5Ea', // USDC testnet
  MON: '0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701',   // WrappedMonad (WMON)
  WETH: '0xB5a30b0FDc5EA94A52fDc42e3E9760Cb8449Fb37'    // WETH testnet
};

// Uniswap V3 Contract Addresses on Monad Testnet
export const UNISWAP_V3_ADDRESSES = {
  FACTORY: '0x961235a9020b05c44df1026d956d1f4d78014276',
  ROUTER: '0x3ae6d8a282d67893e17aa70ebffb33ee5aa65893', // Universal Router
  QUOTER: '0x3ae6d8a282d67893e17aa70ebffb33ee5aa65893', // Using Universal Router for quotes
} as const;

// Network configuration
export const MONAD_TESTNET = {
  chainId: 10143,
  name: 'Monad Testnet',
  rpcUrl: 'https://testnet-rpc.monad.xyz',
  blockExplorer: 'https://testnet.monadexplorer.com',
  nativeCurrency: {
    name: 'Monad',
    symbol: 'MON',
    decimals: 18,
  },
} as const;
