import React from 'react';
import { TOKENS, type Token } from '@/lib/constants';
import { MonBirdIcon, UsdcBirdIcon, WethBirdIcon } from '@/lib/icons';
import { useToast } from '@/hooks/use-toast';

const BIRD_ICONS: Record<Token, React.FC<any>> = {
  USDC: UsdcBirdIcon,
  MON: MonBirdIcon,
  WETH: WethBirdIcon,
};

interface BirdSelectionProps {
  selectedBird: Token;
  onBirdSelect: (bird: Token) => void;
  balances: Record<Token, number>;
}

export function BirdSelection({ selectedBird, onBirdSelect, balances }: BirdSelectionProps) {
  const { toast } = useToast();

  const handleBirdClick = (token: Token) => {
    const hasBalance = balances[token] > 0;
    
    if (hasBalance) {
      onBirdSelect(token);
    } else {
      toast({
        title: 'No Balance',
        description: `You need ${token} tokens to select this bird.`,
        variant: 'destructive'
      });
    }
  };

  return (
    <div 
      className="fixed w-52 sm:w-48 bottom-4 left-2 sm:left-0 p-4 sm:p-3 bg-white/90 rounded-xl shadow-lg backdrop-blur-sm z-30"
      style={{ pointerEvents: 'auto' }}
    >
      <h3 className="text-sm font-semibold text-gray-700 mb-2">Select Bird</h3>
      <div className="flex gap-2 sm:gap-2">
        {Object.keys(TOKENS).map(token => {
          const balance = balances[token as Token];
          const isSelected = selectedBird === token;
          const hasBalance = balance > 0;
          
          return (
            <button 
              key={token} 
              onClick={(e) => {
                e.stopPropagation();
                handleBirdClick(token as Token);
              }} 
              disabled={!hasBalance}
              className={`
                relative p-4 sm:p-3 rounded-lg transition-all duration-200 min-h-[64px] sm:min-h-auto
                ${isSelected ? 'bg-blue-500 ring-2 ring-blue-300 shadow-lg scale-105' : 'bg-gray-100 hover:bg-gray-200'} 
                ${hasBalance ? 'cursor-pointer hover:scale-110 active:scale-95' : 'cursor-not-allowed opacity-50'}
              `}
            >
              {React.createElement(BIRD_ICONS[token as Token], { 
                className: `w-10 h-10 sm:w-8 sm:h-8 ${isSelected ? 'text-white' : 'text-gray-600'}` 
              })}
              <div className={`text-xs mt-1 ${isSelected ? 'text-white' : 'text-gray-600'}`}>
                {balance.toFixed(2)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
} 