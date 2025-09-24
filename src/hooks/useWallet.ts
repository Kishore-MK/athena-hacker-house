import { useCallback } from 'react';
import { useAccount, useConnect, useDisconnect, useBalance, useSendTransaction } from 'wagmi';
import { useToast } from '@/hooks/use-toast';
import { TOKEN_ADDRESSES, type Token } from '@/lib/constants';
import { swapTokens } from '@/lib/simpleSwap';
import { testSwapTokens } from '@/lib/testSwap';

export function useWallet() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { sendTransactionAsync } = useSendTransaction();
  const { toast } = useToast();
  
  const { data: monBalance } = useBalance({ address, chainId: 10143 });
  const { data: usdcBalance } = useBalance({ address, token: TOKEN_ADDRESSES.USDC });
  const { data: wethBalance } = useBalance({ address, token: TOKEN_ADDRESSES.WETH });

  const balances: Record<Token, number> = {
    MON: parseFloat(monBalance?.formatted || '0'),
    USDC: parseFloat(usdcBalance?.formatted || '0'),
    WETH: parseFloat(wethBalance?.formatted || '0'),
  };

  const handleSwap = useCallback(async (fromToken: Token, toToken: Token) => {
    console.log('🚀 UNISWAP V3 SWAP FUNCTION CALLED', {
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
    
    // Get the raw balance data to check if user has tokens
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

    try {
      console.log('🔄 Executing Uniswap V2 swap...', {
        fromToken,
        toToken,
        amount: balanceData.value.toString(),
        formattedAmount: balanceData.formatted,
        userAddress: address
      });
      
      // First test with test swap to verify logic works
      console.log('🔄 Using TEST SWAP to verify tower hit logic...');
      const txHash = await testSwapTokens(
        fromToken,
        toToken,
        balanceData.value.toString(),
        address,
        sendTransactionAsync
      );
      
      // TODO: Uncomment below for real swaps once testing is complete
      // const txHash = await swapTokens(
      //   fromToken,
      //   toToken,
      //   balanceData.value.toString(),
      //   address,
      //   sendTransactionAsync
      // );

      console.log('✅ SWAP TRANSACTION SUBMITTED!', { 
        txHash,
        amount: balanceData.formatted,
        fromToken,
        toToken,
        explorerLink: `https://testnet.monadexplorer.com/tx/${txHash}`
      });

      toast({
        title: 'Swap Submitted!',
        description: `Swapping ${balanceData.formatted} ${fromToken} for ${toToken} via Uniswap V2!`,
      });

    } catch (error) {
       console.error('❌ SWAP ERROR:', error);
       
       // More detailed error logging
       if (error instanceof Error) {
         console.error('Error message:', error.message);
         console.error('Error stack:', error.stack);
       }
       
       toast({
        title: 'Swap Failed',
        description: error instanceof Error ? error.message : 'An unknown error occurred during the swap.',
        variant: 'destructive',
      });
    }
  }, [isConnected, address, toast, sendTransactionAsync, monBalance, usdcBalance, wethBalance]);

  return {
    address,
    isConnected,
    connectors,
    isConnecting,
    balances,
    connect,
    disconnect,
    handleSwap,
  };
} 