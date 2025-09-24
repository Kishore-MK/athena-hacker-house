'use client';

import { http, createConfig, cookieStorage, createStorage } from 'wagmi';
import { monadTestnet } from '@/lib/chains';
import { injected } from 'wagmi/connectors';

export const config = createConfig({
  chains: [monadTestnet],
  ssr: true,
  storage: createStorage({  
    storage: cookieStorage, 
  }),
  connectors: [ 
    injected({
      target: {
        id: 'metamask',
        name: 'MetaMask',
        provider: () => typeof window !== 'undefined' && window.ethereum?.isMetaMask ? window.ethereum : undefined,
      },
    }), 
  ],
  transports: {
    [monadTestnet.id]: http(),
  },
});

