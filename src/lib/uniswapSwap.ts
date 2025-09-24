import { ethers } from 'ethers';
import { Token as UniToken, CurrencyAmount, TradeType, Percent } from '@uniswap/sdk-core';
import { Route, Trade, Pool, FeeAmount } from '@uniswap/v3-sdk';
import { AlphaRouter } from '@uniswap/smart-order-router';
import { TOKEN_ADDRESSES, UNISWAP_V3_ADDRESSES, MONAD_TESTNET, type Token } from './constants';

// ERC20 ABI (minimal for approve and balanceOf)
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function balanceOf(address owner) external view returns (uint256)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
];

// Universal Router ABI (simplified)
const UNIVERSAL_ROUTER_ABI = [
  {
    inputs: [
      { internalType: 'bytes', name: 'commands', type: 'bytes' },
      { internalType: 'bytes[]', name: 'inputs', type: 'bytes[]' },
      { internalType: 'uint256', name: 'deadline', type: 'uint256' },
    ],
    name: 'execute',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
];

// Token configurations
const TOKEN_CONFIGS: Record<Token, { decimals: number; symbol: string }> = {
  MON: { decimals: 18, symbol: 'WMON' },
  USDC: { decimals: 6, symbol: 'USDC' },
  WETH: { decimals: 18, symbol: 'WETH' },
};

export class UniswapV3SwapService {
  private provider: ethers.providers.Provider;
  private signer: ethers.Signer;
  private router: AlphaRouter;

  constructor(provider: ethers.providers.Provider, signer: ethers.Signer) {
    this.provider = provider;
    this.signer = signer;
    this.router = new AlphaRouter({
      chainId: MONAD_TESTNET.chainId,
      provider: this.provider,
    });
  }

  private createToken(tokenSymbol: Token): UniToken {
    const config = TOKEN_CONFIGS[tokenSymbol];
    return new UniToken(
      MONAD_TESTNET.chainId,
      TOKEN_ADDRESSES[tokenSymbol],
      config.decimals,
      config.symbol,
      config.symbol
    );
  }

  async checkAndApproveToken(
    tokenAddress: string,
    spenderAddress: string,
    amount: ethers.BigNumber
  ): Promise<void> {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.signer);
    
    console.log('💰 Checking token approval', {
      token: tokenAddress,
      spender: spenderAddress,
      amount: amount.toString(),
    });

    try {
      const currentAllowance = await tokenContract.allowance(
        await this.signer.getAddress(),
        spenderAddress
      );

      console.log('📋 Current allowance:', currentAllowance.toString());

      if (currentAllowance.lt(amount)) {
        console.log('⚠️ Insufficient allowance, approving tokens...');
        
        const approveTx = await tokenContract.approve(spenderAddress, ethers.constants.MaxUint256);
        console.log('📤 Approval transaction sent:', approveTx.hash);
        
        const receipt = await approveTx.wait();
        console.log('✅ Approval confirmed in block:', receipt.blockNumber);
      } else {
        console.log('✅ Sufficient allowance already exists');
      }
    } catch (error) {
      console.error('❌ Approval failed:', error);
      throw new Error(`Token approval failed: ${error}`);
    }
  }

  async getTokenBalance(tokenAddress: string): Promise<ethers.BigNumber> {
    if (tokenAddress === TOKEN_ADDRESSES.MON) {
      // For native MON, check ETH balance
      return await this.signer.getBalance();
    } else {
      // For ERC20 tokens
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
      return await tokenContract.balanceOf(await this.signer.getAddress());
    }
  }

  async executeSwap(fromToken: Token, toToken: Token): Promise<string> {
    try {
      console.log('🚀 UNISWAP V3 SWAP STARTED', {
        from: fromToken,
        to: toToken,
        timestamp: new Date().toISOString(),
      });

      // Get token balance
      const fromTokenAddress = TOKEN_ADDRESSES[fromToken];
      const balance = await this.getTokenBalance(fromTokenAddress);
      
      if (balance.isZero()) {
        throw new Error(`No ${fromToken} balance to swap`);
      }

      console.log('💰 Token balance:', {
        token: fromToken,
        balance: ethers.utils.formatUnits(balance, TOKEN_CONFIGS[fromToken].decimals),
      });

      // Create token instances
      const tokenIn = this.createToken(fromToken);
      const tokenOut = this.createToken(toToken);

      // Create currency amount
      const amountIn = CurrencyAmount.fromRawAmount(tokenIn, balance.toString());

      console.log('🔄 Getting route from Uniswap...');

      // Get route using AlphaRouter
      const route = await this.router.route(
        amountIn,
        tokenOut,
        TradeType.EXACT_INPUT,
        {
          recipient: await this.signer.getAddress(),
          slippageTolerance: new Percent(50, 10_000), // 0.5% slippage
          deadline: Math.floor(Date.now() / 1000) + 60 * 20, // 20 minutes
        }
      );

      if (!route) {
        throw new Error('No route found for this swap');
      }

      console.log('✅ Route found:', {
        expectedOutput: route.quote.toExact(),
        priceImpact: route.trade.priceImpact.toFixed(2) + '%',
        gas: route.estimatedGasUsed.toString(),
      });

      // For ERC20 tokens (not native MON), we need to approve first
      if (fromToken !== 'MON') {
        await this.checkAndApproveToken(
          fromTokenAddress,
          UNISWAP_V3_ADDRESSES.ROUTER,
          balance
        );
      }

      // Execute the swap
      console.log('📤 Executing swap transaction...');

      const transaction = {
        data: route.methodParameters?.calldata,
        to: UNISWAP_V3_ADDRESSES.ROUTER,
        value: fromToken === 'MON' ? balance : ethers.BigNumber.from(0),
        gasLimit: route.estimatedGasUsed.mul(120).div(100), // Add 20% gas buffer
      };

      const swapTx = await this.signer.sendTransaction(transaction);
      console.log('📋 Swap transaction sent:', swapTx.hash);

      const receipt = await swapTx.wait();
      console.log('✅ Swap confirmed in block:', receipt.blockNumber);

      return swapTx.hash;
    } catch (error) {
      console.error('❌ Swap failed:', error);
      throw error;
    }
  }
}

// Helper function to create swap service instance
export function createSwapService(provider: ethers.providers.Provider, signer: ethers.Signer): UniswapV3SwapService {
  return new UniswapV3SwapService(provider, signer);
} 