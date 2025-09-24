'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { type Token } from '@/lib/constants';

// Import custom hooks
import { useWallet } from '@/hooks/useWallet';
import { useGameLogic } from '@/hooks/useGameLogic';
import { useGameControls } from '@/hooks/useGameControls';

// Import UI components
import { GameStatus } from './ui/GameStatus';
import { BirdSelection } from './ui/BirdSelection';
import { BalancePanel } from './ui/BalancePanel';
import { WalletConnectionOverlay } from './ui/WalletConnectionOverlay';
import { GameOverlay } from './ui/GameOverlay';

// Import game object components
import { Tower } from './objects/Tower';
import { Bird } from './objects/Bird';
import { Slingshot } from './objects/Slingshot';

export function DeFiBirdsGame() {
  const [selectedBird, setSelectedBird] = useState<Token>('MON');
  
  // Initialize hooks
  const wallet = useWallet();
  const gameLogic = useGameLogic({
    selectedBird,
    balances: wallet.balances,
    isConnected: wallet.isConnected,
    handleSwap: wallet.handleSwap,
  });
  
  const controls = useGameControls({
    gameState: gameLogic.gameState,
    setGameState: gameLogic.setGameState,
    isConnected: wallet.isConnected,
    selectedBird,
    balances: wallet.balances,
    isDragging: gameLogic.isDragging,
    setIsDragging: gameLogic.setIsDragging,
    setDragStart: gameLogic.setDragStart,
    setDragEnd: gameLogic.setDragEnd,
    dragEnd: gameLogic.dragEnd,
    setBirdVelocity: gameLogic.setBirdVelocity,
  });

  // Auto-select a bird with balance if current bird has no balance
  useEffect(() => {
    if (wallet.isConnected && wallet.balances[selectedBird] <= 0) {
      const birdWithBalance = (Object.keys(wallet.balances) as Token[]).find(token => wallet.balances[token] > 0);
      if (birdWithBalance && birdWithBalance !== selectedBird) {
        setSelectedBird(birdWithBalance);
      }
    }
  }, [wallet.balances, selectedBird, wallet.isConnected]);

  return (
    <div
      ref={gameLogic.gameAreaRef}
      className="relative w-full h-[500px] sm:h-[600px] max-w-5xl bg-transparent overflow-hidden select-none touch-none"
      onMouseDown={controls.handleMouseDown}
      onMouseMove={controls.handleMouseMove}
      onMouseUp={controls.handleMouseUp}
      onMouseLeave={controls.handleMouseUp}
      onTouchStart={controls.handleTouchStart}
      onTouchMove={controls.handleTouchMove}
      onTouchEnd={controls.handleTouchEnd}
      onTouchCancel={controls.handleTouchEnd}
      style={{ cursor: gameLogic.gameState === 'ready' && wallet.isConnected && wallet.balances[selectedBird] > 0 ? 'grab' : 'default' }}
    > 
      {/* Balance Panel */}
      <BalancePanel
        balances={wallet.balances}
        chances={gameLogic.chances}
        isConnected={wallet.isConnected}
        address={wallet.address}
        connectors={wallet.connectors}
        isConnecting={wallet.isConnecting}
        onConnect={wallet.connect}
        onDisconnect={wallet.disconnect}
      />
      
      {/* Bird Selection UI */}
      <BirdSelection
        selectedBird={selectedBird}
        onBirdSelect={setSelectedBird}
        balances={wallet.balances}
      />

      {/* Game Status UI */}
      <GameStatus
        chances={gameLogic.chances}
        gameState={gameLogic.gameState}
      />

      {/* Towers */}
      {gameLogic.towers.map(tower => (
        <Tower 
          key={tower.token}
          tower={tower}
          gameState={gameLogic.gameState}
          hitTower={gameLogic.hitTower}
        />
      ))}

      {/* Slingshot */}
      <Slingshot
        isDragging={gameLogic.isDragging}
        dragEnd={gameLogic.dragEnd}
      />

      {/* Bird */}
      <Bird
        selectedBird={selectedBird}
        gameState={gameLogic.gameState}
        birdPosition={gameLogic.birdPosition}
        birdVelocity={gameLogic.birdVelocity}
        dragEnd={gameLogic.dragEnd}
        chances={gameLogic.chances}
      />
      
      {/* Game Over Overlay */}
      <GameOverlay
        gameState={gameLogic.gameState}
        selectedBird={selectedBird}
        onNewGame={gameLogic.handleNewTurn}
      />

      {/* Wallet Connection Overlay */}
      <WalletConnectionOverlay
        isConnected={wallet.isConnected}
        connectors={wallet.connectors}
        isConnecting={wallet.isConnecting}
        onConnect={wallet.connect}
      />
    </div>
  );
} 