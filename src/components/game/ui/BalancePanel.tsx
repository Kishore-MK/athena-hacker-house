import React from 'react';
import { Button } from '@/components/ui/button';
import { type Token } from '@/lib/constants';

interface BalancePanelProps {
  balances: Record<Token, number>;
  chances: number;
  isConnected: boolean;
  address?: string;
  connectors: any[];
  isConnecting: boolean;
  onConnect: (connector: any) => void;
  onDisconnect: () => void;
}

export function BalancePanel({ 
  balances, 
  chances, 
  isConnected, 
  address, 
  connectors, 
  isConnecting, 
  onConnect, 
  onDisconnect 
}: BalancePanelProps) {
  return (
    <div 
      className="fixed top-2 left-2 sm:top-4 sm:left-4 p-3 sm:p-4 bg-white/80 rounded-lg shadow-md backdrop-blur-sm z-30 text-sm sm:text-base"
      style={{ pointerEvents: 'auto' }}
    >
      <h2 className="text-lg font-bold">Balances</h2>
      {Object.entries(balances).map(([token, balance]) => (
        <p key={token}>{token}: {balance.toFixed(4)}</p>
      ))}
      <h2 className="text-lg font-bold mt-2">Chances</h2>
      <p>{chances}</p>
      <div className="mt-4">
        {isConnected ? (
          <div>
            <p className="text-xs truncate">Connected: {address}</p>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={onDisconnect} 
              className="mt-1 w-full min-h-[40px] sm:min-h-auto"
            >
              Disconnect
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {(() => {
              const metamaskConnectors = connectors.filter((connector) => 
                connector.name.toLowerCase().includes('metamask')
              );
              const connector = metamaskConnectors[0];
              
              return connector ? (
                <Button 
                  key={connector.uid} 
                  onClick={() => onConnect(connector)} 
                  disabled={isConnecting} 
                  className="min-h-[48px] sm:min-h-auto text-base sm:text-sm"
                >
                  {isConnecting ? 'Connecting...' : 'Connect MetaMask'}
                </Button>
              ) : (
                <Button disabled className="min-h-[48px] sm:min-h-auto text-base sm:text-sm">
                  MetaMask not detected
                </Button>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
} 