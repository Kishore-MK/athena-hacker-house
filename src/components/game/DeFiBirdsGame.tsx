
'use client';

import * as React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeftRight, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { TOKENS, SWAP_PAIRS, type Token, GAME_CONFIG, TOKEN_ADDRESSES } from '@/lib/constants';
import { MonBirdIcon, UsdcBirdIcon, WethBirdIcon } from '@/lib/icons';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast'; 
import { useAccount, useConnect, useDisconnect, useSendTransaction, useBalance } from 'wagmi';
import { parseEther } from 'viem';

type GameState = 'ready' | 'aiming' | 'flying' | 'hit' | 'miss' | 'swapping' | 'gameover';

type Vector2D = { x: number; y: number };

type Block = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isHit: boolean;
};

type TowerStructure = {
  token: Token;
  blocks: Block[];
};


const BIRD_ICONS: Record<Token, React.FC<any>> = {
  USDC: UsdcBirdIcon,
  MON: MonBirdIcon,
  WETH: WethBirdIcon,
};

function generateTower(token: Token, index: number, gameAreaWidth: number): TowerStructure {
  const blocks: Block[] = [];
  const base_x = gameAreaWidth - 300 - (index * 180); // Better spacing
  const blockWidth = 40;
  const blockHeight = 20;
  const levels = Math.floor(Math.random() * 3) + 3; // 3 to 5 levels for better gameplay

  let blockCount = 0;
  for (let level = 0; level < levels; level++) {
    const numBlocks = Math.max(1, levels - level);
    const levelWidth = numBlocks * blockWidth;
    const startX = base_x + (GAME_CONFIG.towerWidth - levelWidth) / 2;
    for (let i = 0; i < numBlocks; i++) {
      blocks.push({
        id: `${token}-${blockCount++}`,
        x: startX + i * blockWidth,
        y: level * blockHeight, // Y is distance from ground, not absolute position
        width: blockWidth,
        height: blockHeight,
        isHit: false,
      });
    }
  }

  // Add target block at the top
  const topY = levels * blockHeight;
  blocks.push({
    id: `${token}-target`,
    x: base_x + (GAME_CONFIG.towerWidth - 60) / 2, // Slightly smaller target
    y: topY,
    width: 60,
    height: 60,
    isHit: false,
  });

  return { token, blocks };
}


export function DeFiBirdsGame() {
  const [gameState, setGameState] = useState<GameState>('ready');
  const [selectedBird, setSelectedBird] = useState<Token>('MON');
  

  const [chances, setChances] = useState(3);
  
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { sendTransactionAsync } = useSendTransaction();
  
  const { data: monBalance } = useBalance({ address, chainId: 10143,});
  const { data: usdcBalance } = useBalance({ address, token: TOKEN_ADDRESSES.USDC });
  const { data: wethBalance } = useBalance({ address, token: TOKEN_ADDRESSES.WETH });

  const balances: Record<Token, number> = {
    MON: parseFloat(monBalance?.formatted || '0'),
    USDC: parseFloat(usdcBalance?.formatted || '0'),
    WETH: parseFloat(wethBalance?.formatted || '0'),
  };
  
  const [towers, setTowers] = useState<TowerStructure[]>([]);
  const [hitTower, setHitTower] = useState<Token | null>(null);

  const [birdPosition, setBirdPosition] = useState<Vector2D>(GAME_CONFIG.slingshotPosition);
  const [birdVelocity, setBirdVelocity] = useState<Vector2D>({ x: 0, y: 0 });
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Vector2D>({ x: 0, y: 0 });
  const [dragEnd, setDragEnd] = useState<Vector2D>(GAME_CONFIG.slingshotPosition);
  
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>();
  const { toast } = useToast();
  
  // Auto-select a bird with balance if current bird has no balance
  useEffect(() => {
    if (isConnected && balances[selectedBird] <= 0) {
      // Find a bird with balance
      const birdWithBalance = (Object.keys(TOKENS) as Token[]).find(token => balances[token] > 0);
      if (birdWithBalance && birdWithBalance !== selectedBird) {
        setSelectedBird(birdWithBalance);
        toast({
          title: 'Bird Auto-Selected',
          description: `Switched to ${birdWithBalance} bird since it has balance.`,
        });
      }
    }
  }, [balances, selectedBird, isConnected, toast]);
  
  const resetBird = useCallback(() => {
    setBirdPosition(GAME_CONFIG.slingshotPosition);
    setBirdVelocity({ x: 0, y: 0 });
    setGameState('ready');
    setHitTower(null);
  }, []);

  const setupTowers = useCallback(() => {
    const gameArea = gameAreaRef.current;
    if (!gameArea) return;
    const width = gameArea.getBoundingClientRect().width;
    const possibleTargets = SWAP_PAIRS[selectedBird];
    setTowers(possibleTargets.map((token, index) => generateTower(token, index, width)));
  }, [selectedBird]);

  const handleNewTurn = useCallback(() => {
    resetBird();
    setupTowers();
    setChances(3);
  }, [resetBird, setupTowers]);
  
  useEffect(() => {
    handleNewTurn();
  }, [selectedBird, handleNewTurn]);
  
  const handleSwap = useCallback(async (fromToken: Token, toToken: Token) => {
    console.log('🚀 SWAP FUNCTION CALLED', {
      fromToken,
      toToken,
      isConnected,
      address: address || 'undefined',
      timestamp: new Date().toISOString()
    });

    if (!isConnected || !address) {
      console.log('❌ SWAP FAILED - Wallet not connected');
      toast({ title: 'Wallet not connected', description: 'Please connect your wallet to swap tokens.', variant: 'destructive' });
      return;
    }
    
    // Get the raw balance data to access the actual balance in wei
    const balanceData = fromToken === 'MON' ? monBalance : 
                       fromToken === 'USDC' ? usdcBalance : wethBalance;
    
    console.log('💰 BALANCE CHECK', {
      fromToken,
      balanceData: balanceData ? {
        formatted: balanceData.formatted,
        value: balanceData.value?.toString(),
        decimals: balanceData.decimals
      } : 'undefined',
      hasBalance: !!(balanceData && balanceData.value && balanceData.value > BigInt(0))
    });
    
    if (!balanceData || !balanceData.value || balanceData.value === BigInt(0)) {
      console.log('❌ SWAP FAILED - Insufficient balance');
      toast({ 
        title: 'Insufficient Balance', 
        description: `You don't have any ${fromToken} tokens to swap.`, 
        variant: 'destructive' 
      });
      return;
    }

    // Use the entire balance for the swap
    const sellAmount = balanceData.value;
    const sellTokenAddress = TOKEN_ADDRESSES[fromToken];
    const buyTokenAddress = TOKEN_ADDRESSES[toToken];

    console.log(`Swapping entire balance of ${fromToken}:`, {
      amount: sellAmount.toString(),
      formatted: balanceData.formatted,
      from: fromToken,
      to: toToken
    });

    try {
      // Build the API request with all required parameters for Monad testnet
      const params = new URLSearchParams({
        buyToken: buyTokenAddress,
        sellToken: sellTokenAddress,
        sellAmount: sellAmount.toString(),
        chainId: '10143', // Monad testnet
        taker: address, // Include taker address for better quotes
      });

      console.log('📡 CALLING 0x API', { 
        url: `/api/0x/quote?${params.toString()}`,
        params: Object.fromEntries(params.entries())
      });

      const response = await fetch(`/api/0x/quote?${params.toString()}`);
      if (!response.ok) {
        const error = await response.json();
        console.log('❌ 0x API ERROR', { status: response.status, error });
        throw new Error(error.error || 'Failed to fetch swap quote.');
      }
      const quote = await response.json();

      console.log('✅ 0x QUOTE RECEIVED', {
        to: quote.to,
        gas: quote.gas,
        value: quote.value,
        hasData: !!quote.data,
        dataLength: quote.data?.length || 0
      });

      console.log('📤 SENDING TRANSACTION');
      const txResult = await sendTransactionAsync({
        to: quote.to,
        data: quote.data,
        value: BigInt(quote.value || '0'),
        gas: BigInt(quote.gas),
      });

      console.log('✅ TRANSACTION SENT', { 
        hash: txResult,
        amount: balanceData.formatted,
        fromToken,
        toToken 
      });

      toast({
        title: 'Swap Submitted!',
        description: `Swapping entire ${balanceData.formatted} ${fromToken} for ${toToken}. Transaction submitted!`,
      });

    } catch (error) {
       console.error('Swap error:', error);
       toast({
        title: 'Swap Failed',
        description: error instanceof Error ? error.message : 'An unknown error occurred.',
        variant: 'destructive',
      });
    } finally {
       setTimeout(() => {
          handleNewTurn();
      }, 1000);
    }
  }, [isConnected, address, toast, handleNewTurn, sendTransactionAsync, monBalance, usdcBalance, wethBalance]);

  const gameLoop = useCallback(() => {
    if (gameState !== 'flying') return;

    setBirdPosition(prevPos => {
      const newPos = {
        x: prevPos.x + birdVelocity.x,
        y: prevPos.y + birdVelocity.y,
      };

      const gameArea = gameAreaRef.current?.getBoundingClientRect();
      if (!gameArea) return newPos;
      
      const groundY = gameArea.height - GAME_CONFIG.groundHeight;

      if (newPos.y > groundY - GAME_CONFIG.birdSize.height / 2 || newPos.y < 0) {
        setGameState('miss');
        return prevPos;
      }
      
      if (newPos.x < 0 || newPos.x > gameArea.width) {
        setGameState('miss');
        return prevPos;
      }

      let collision = false;
      setTowers(currentTowers => 
        currentTowers.map(tower => {
          const updatedBlocks = tower.blocks.map(block => {
            // Calculate block's actual screen position to match rendering
            // Blocks are rendered with: bottom: GAME_CONFIG.groundHeight + block.y
            // We need to convert this to top-origin coordinates to match bird positioning
            // Block bottom in top-origin: gameArea.height - (GAME_CONFIG.groundHeight + block.y)
            // Block top in top-origin: gameArea.height - (GAME_CONFIG.groundHeight + block.y + block.height)
            const blockBottomY = gameArea.height - (GAME_CONFIG.groundHeight + block.y);
            const blockTopY = gameArea.height - (GAME_CONFIG.groundHeight + block.y + block.height);
            
            if (!block.isHit && 
              // X collision check - bird center vs block edges
              newPos.x + GAME_CONFIG.birdSize.width / 2 > block.x && 
              newPos.x - GAME_CONFIG.birdSize.width / 2 < block.x + block.width &&
              // Y collision check - bird center vs block edges (remember Y increases downward in screen coordinates)
              newPos.y + GAME_CONFIG.birdSize.height / 2 > blockTopY && 
              newPos.y - GAME_CONFIG.birdSize.height / 2 < blockBottomY
            ) {
              collision = true;
              const isTarget = block.id.includes('target');
              
              console.log('🎯 BLOCK HIT!', {
                blockId: block.id,
                blockType: isTarget ? 'TARGET TOWER' : 'regular block',
                tower: tower.token,
                birdToken: selectedBird,
                birdPos: { x: newPos.x, y: newPos.y },
                blockBounds: { 
                  x: { left: block.x, right: block.x + block.width },
                  y: { top: blockTopY, bottom: blockBottomY }
                },
                timestamp: new Date().toISOString()
              });
              
              if (isTarget) {
                console.log('🏰 TARGET TOWER DESTROYED!', {
                  towerToken: tower.token,
                  willSwapFrom: selectedBird,
                  willSwapTo: tower.token,
                  action: 'Setting hitTower state'
                });
                setHitTower(tower.token);
              } else {
                console.log('🧱 Regular block destroyed', { blockId: block.id });
              }
              
              return { ...block, isHit: true };
            }
            return block;
          });
          return { ...tower, blocks: updatedBlocks };
        })
      );
      
      if (collision) {
        console.log('💥 COLLISION DETECTED - Game state changing to HIT');
        setGameState('hit');
      }
      
      return newPos;
    });

    setBirdVelocity(prevVel => ({
      x: prevVel.x * 0.995,
      y: prevVel.y + GAME_CONFIG.gravity,
    }));

    animationFrameRef.current = requestAnimationFrame(gameLoop);
  }, [gameState, birdVelocity.x, birdVelocity.y]);

  useEffect(() => {
    if (gameState === 'flying') {
      animationFrameRef.current = requestAnimationFrame(gameLoop);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameState, gameLoop]);
  
  useEffect(() => {
    console.log('🎮 GAME STATE EFFECT TRIGGERED', {
      gameState,
      hitTower,
      selectedBird,
      chances,
      timestamp: new Date().toISOString()
    });

    if (gameState === 'hit' && hitTower) {
      console.log('🔄 INITIATING SWAP SEQUENCE', {
        from: selectedBird,
        to: hitTower,
        action: 'About to call handleSwap',
        gameStateWillChangeTo: 'swapping'
      });
      setGameState('swapping');
      handleSwap(selectedBird, hitTower);
    } else if (gameState === 'miss' || (gameState === 'hit' && !hitTower)) {
        console.log('❌ MISS OR NON-TARGET HIT', {
          gameState,
          hitTower,
          chances,
          action: chances > 1 ? 'Reducing chances' : 'Game over'
        });
        if (chances > 1) {
            setChances(prev => prev - 1);
            setTimeout(() => {
                resetBird();
            }, 1500);
        } else {
            setGameState('gameover');
        }
    }
  }, [gameState, hitTower, selectedBird, toast, resetBird, chances, handleSwap]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (gameState !== 'ready' || !isConnected) return;
    
    // Check if the selected bird has balance before allowing gameplay
    const currentBalance = balances[selectedBird];
    if (currentBalance <= 0) {
      toast({ 
        title: 'No Balance', 
        description: `You need some ${selectedBird} tokens to play with this bird.`, 
        variant: 'destructive' 
      });
      return;
    }
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const distFromSlingshot = Math.sqrt(
      (x - GAME_CONFIG.slingshotPosition.x)**2 + (y - GAME_CONFIG.slingshotPosition.y)**2
    );

    if (distFromSlingshot > GAME_CONFIG.birdSize.width) return;

    setGameState('aiming');
    setIsDragging(true);
    setDragStart({ x, y });
    setDragEnd(GAME_CONFIG.slingshotPosition);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault(); // Prevent scrolling
    if (gameState !== 'ready' || !isConnected) return;
    
    // Check if the selected bird has balance before allowing gameplay
    const currentBalance = balances[selectedBird];
    if (currentBalance <= 0) {
      toast({ 
        title: 'No Balance', 
        description: `You need some ${selectedBird} tokens to play with this bird.`, 
        variant: 'destructive' 
      });
      return;
    }
    
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    const distFromSlingshot = Math.sqrt(
      (x - GAME_CONFIG.slingshotPosition.x)**2 + (y - GAME_CONFIG.slingshotPosition.y)**2
    );

    if (distFromSlingshot > GAME_CONFIG.birdSize.width) return;

    setGameState('aiming');
    setIsDragging(true);
    setDragStart({ x, y });
    setDragEnd(GAME_CONFIG.slingshotPosition);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const currentPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    
    const dx = currentPos.x - GAME_CONFIG.slingshotPosition.x;
    const dy = currentPos.y - GAME_CONFIG.slingshotPosition.y;
    let dist = Math.sqrt(dx * dx + dy * dy);
    dist = Math.min(dist, GAME_CONFIG.maxDragDistance);
    const angle = Math.atan2(dy, dx);
    
    setDragEnd({
        x: GAME_CONFIG.slingshotPosition.x + Math.cos(angle) * dist,
        y: GAME_CONFIG.slingshotPosition.y + Math.sin(angle) * dist,
    });
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault(); // Prevent scrolling
    if (!isDragging) return;
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const currentPos = { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    
    const dx = currentPos.x - GAME_CONFIG.slingshotPosition.x;
    const dy = currentPos.y - GAME_CONFIG.slingshotPosition.y;
    let dist = Math.sqrt(dx * dx + dy * dy);
    dist = Math.min(dist, GAME_CONFIG.maxDragDistance);
    const angle = Math.atan2(dy, dx);
    
    setDragEnd({
        x: GAME_CONFIG.slingshotPosition.x + Math.cos(angle) * dist,
        y: GAME_CONFIG.slingshotPosition.y + Math.sin(angle) * dist,
    });
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    
    const dx = GAME_CONFIG.slingshotPosition.x - dragEnd.x;
    const dy = GAME_CONFIG.slingshotPosition.y - dragEnd.y;

    if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
        setGameState('ready');
        return;
    }

    setGameState('flying');
    
    setBirdVelocity({
        x: dx * GAME_CONFIG.launchPower,
        y: dy * GAME_CONFIG.launchPower,
    });
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!isDragging) return;
    setIsDragging(false);
    
    const dx = GAME_CONFIG.slingshotPosition.x - dragEnd.x;
    const dy = GAME_CONFIG.slingshotPosition.y - dragEnd.y;

    if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
        setGameState('ready');
        return;
    }

    setGameState('flying');
    
    setBirdVelocity({
        x: dx * GAME_CONFIG.launchPower,
        y: dy * GAME_CONFIG.launchPower,
    });
  };
  
  const trajectoryPoints = () => {
    if (!isDragging) return [];
    const points = [];
    let simPos = { ...GAME_CONFIG.slingshotPosition };
    const dx = GAME_CONFIG.slingshotPosition.x - dragEnd.x;
    const dy = GAME_CONFIG.slingshotPosition.y - dragEnd.y;
    let simVel = {
        x: dx * GAME_CONFIG.launchPower,
        y: dy * GAME_CONFIG.launchPower
    };

    for (let i = 0; i < 30; i++) {
        simVel.y += GAME_CONFIG.gravity;
        simPos.x += simVel.x;
        simPos.y += simVel.y;
        if(i % 2 === 0) points.push({ ...simPos });
    }
    return points;
  };
  
  const Bird = BIRD_ICONS[selectedBird];

  return (
    <div
      ref={gameAreaRef}
      className="relative w-full h-[600px] max-w-5xl bg-transparent overflow-hidden select-none touch-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      style={{ cursor: gameState === 'ready' && isConnected && balances[selectedBird] > 0 ? 'grab' : 'default' }}
    > 
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
              <Button size="sm" variant="outline" onClick={() => disconnect()} className="mt-1 w-full min-h-[40px] sm:min-h-auto">Disconnect</Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {(() => {
                const metamaskConnectors = connectors.filter((connector) => 
                  connector.name.toLowerCase().includes('metamask')
                );
                // Only show the first MetaMask connector to avoid duplicates
                const connector = metamaskConnectors[0];
                
                return connector ? (
                  <Button key={connector.uid} onClick={() => connect({ connector })} disabled={isConnecting}>
                    {isConnecting ? 'Connecting...' : 'Connect MetaMask'}
                  </Button>
                ) : (
                  <Button disabled>
                    MetaMask not detected
                  </Button>
                );
              })()}
            </div>
          )}
        </div>
      </div>
      
      {/* Bird Selection UI - Mobile Optimized */}
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
                  if (hasBalance) {
                    setSelectedBird(token as Token);
                  } else {
                    toast({
                      title: 'No Balance',
                      description: `You need ${token} tokens to select this bird.`,
                      variant: 'destructive'
                    });
                  }
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

      {/* Game Status UI - Mobile Optimized */}
      <div 
        className="absolute top-2 right-2 sm:top-4 sm:right-4 p-3 bg-white/90 rounded-xl shadow-lg backdrop-blur-sm z-30 text-sm sm:text-base"
        style={{ pointerEvents: 'auto' }}
      >
        <div className="text-sm font-semibold text-gray-700 mb-1">Chances: {chances}</div>
        <div className="text-xs text-gray-600">
          {gameState === 'ready' && 'Aim and shoot!'}
          {gameState === 'aiming' && 'Pull to aim...'}
          {gameState === 'flying' && 'Bird in flight!'}
          {gameState === 'swapping' && 'Swapping tokens...'}
          {gameState === 'hit' && 'Nice shot!'}
          {gameState === 'miss' && 'Try again!'}
        </div>
      </div>

      <AnimatePresence>
        {towers.map(tower => 
          tower.blocks.map(block => {
              const isTargetBlock = block.id.includes('target');
              const isSwapping = gameState === 'swapping' && hitTower === tower.token;
              
              return (
                <motion.div
                  key={block.id}
                  initial={{ opacity: 1, scale: 1, rotate: 0, y: 0 }}
                  animate={{
                    opacity: block.isHit ? 0 : 1,
                    scale: block.isHit ? 0.2 : 1,
                    rotate: block.isHit ? (Math.random() - 0.5) * 180 : 0,
                    y: block.isHit ? 100 : 0,
                  }}
                  transition={{ duration: 0.4, type: 'spring' }}
                  className="absolute"
                  style={{
                    width: block.width,
                    height: block.height,
                    left: block.x,
                    bottom: GAME_CONFIG.groundHeight + block.y,
                  }}
                >
                  {isTargetBlock ? (
                    <div className="relative w-full h-full bg-yellow-900/50 rounded-md flex flex-col items-center justify-between p-2">
                      <AnimatePresence>
                        {isSwapping && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-md z-10"
                          >
                            <Loader2 className="w-12 h-12 text-white animate-spin" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <h3 className="text-xl font-bold text-white">{tower.token}</h3>
                      {React.createElement(TOKENS[tower.token].icon, { className: 'w-10 h-10' })}
                      <ArrowLeftRight className="w-6 h-6 text-white" />
                    </div>
                  ) : (
                    <div className="w-full h-full bg-yellow-900/80 rounded-sm" />
                  )}
                </motion.div>
              );
            }
          )
        )}
      </AnimatePresence>

      <div 
        className="absolute w-8 h-20 bg-yellow-900 rounded-md"
        style={{ left: GAME_CONFIG.slingshotPosition.x - 20, bottom: GAME_CONFIG.groundHeight - 20 }}
      ></div>
      <div 
        className="absolute w-2 h-20 bg-yellow-800 rounded-b-md"
        style={{ left: GAME_CONFIG.slingshotPosition.x + 8, bottom: GAME_CONFIG.groundHeight - 20, transform: 'rotate(10deg)' }}
      ></div>
      <div 
        className="absolute w-2 h-20 bg-yellow-800 rounded-b-md"
        style={{ left: GAME_CONFIG.slingshotPosition.x - 10, bottom: GAME_CONFIG.groundHeight - 20, transform: 'rotate(-10deg)' }}
      ></div>

      {isDragging &&
        trajectoryPoints().map((p, i) => (
          <div
            key={i}
            className="absolute bg-white/50 rounded-full"
            style={{ left: p.x, top: p.y, width: 5, height: 5 }}
          />
        ))}

      <AnimatePresence>
        {gameState !== 'flying' && gameState !== 'hit' && gameState !== 'swapping' &&
          <motion.div 
            key={`${selectedBird}-${chances}`}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            style={{ position: 'absolute', left: dragEnd.x - GAME_CONFIG.birdSize.width/2, top: dragEnd.y - GAME_CONFIG.birdSize.height/2, pointerEvents: 'none' }}>
            <Bird className="w-12 h-12" />
          </motion.div>
        }
      </AnimatePresence>
      
      {gameState === 'flying' &&
        <div style={{ position: 'absolute', transform: `translate(${birdPosition.x - GAME_CONFIG.birdSize.width/2}px, ${birdPosition.y - GAME_CONFIG.birdSize.height/2}px) rotate(${birdVelocity.y * 2}deg)`, transformOrigin: 'center', pointerEvents: 'none' }}>
           <Bird className="w-12 h-12" />
        </div>
      }
      
      {gameState === 'gameover' && 
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className='p-8 bg-white/90 rounded-lg shadow-xl text-center'>
              <h2 className='text-3xl font-bold mb-4'>No more chances!</h2>
              <p className='mb-6'>Select a different bird to continue.</p>
              <Button onClick={() => setSelectedBird(selectedBird)}>Try again with {selectedBird}</Button>
            </div>
        </div>
      }

      {!isConnected && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
            <div className='p-8 bg-white/90 rounded-lg shadow-xl text-center'>
              <h2 className='text-3xl font-bold mb-4'>Connect Your Wallet</h2>
              <p className='mb-6'>Please connect your wallet to play the game.</p>
                            <div className="flex flex-col gap-2">
                {(() => {
                  const metamaskConnectors = connectors.filter((connector) => 
                    connector.name.toLowerCase().includes('metamask')
                  );
                  // Only show the first MetaMask connector to avoid duplicates
                  const connector = metamaskConnectors[0];
                  
                  return connector ? (
                    <Button key={connector.uid} onClick={() => connect({ connector })} disabled={isConnecting}>
                      {isConnecting ? 'Connecting...' : 'Connect MetaMask'}
                    </Button>
                  ) : (
                    <Button disabled>
                      MetaMask not detected - Please install MetaMask
                    </Button>
                  );
                })()}
              </div>
            </div>
        </div>
      )}
    </div>
  );
}

    
