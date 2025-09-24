import { ethers } from 'ethers';
import { TOKEN_ADDRESSES, UNISWAP_V3_ADDRESSES, type Token } from './constants';

// Minimal ERC20 ABI for approve and balanceOf
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function balanceOf(address owner) external view returns (uint256)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
];

// Simplified Universal Router ABI for basic swaps
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
const TOKEN_CONFIGS: Record<Token, { decimals: number }> = {
  MON: { decimals: 18 },
  USDC: { decimals: 6 },
  WETH: { decimals: 18 },
};

export interface SwapParams {
  fromToken: Token;
  toToken: Token;
  amountIn: string; // Amount in wei
  userAddress: string;
  deadline?: number;
}

export interface SwapQuote {
  amountOut: string;
  calldata: string;
  value: string;
}

export async function checkTokenApproval(
  tokenAddress: string,
  owner: string,
  spender: string,
  amount: string,
  sendTransaction: any
): Promise<boolean> {
  try {
    console.log('🔍 Checking token approval...', {
      token: tokenAddress,
      owner,
      spender,
      amount,
    });

    // For native token (MON), no approval needed
    if (tokenAddress === TOKEN_ADDRESSES.MON) {
      return true;
    }

    // Check current allowance using a read call
    const provider = new ethers.providers.JsonRpcProvider('https://testnet-rpc.monad.xyz');
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    
    const currentAllowance = await tokenContract.allowance(owner, spender);
    
    console.log('📋 Current allowance:', currentAllowance.toString());
    
    if (currentAllowance.lt(ethers.BigNumber.from(amount))) {
      console.log('⚠️ Insufficient allowance, requesting approval...');
      
      // Send approval transaction
      const result = await sendTransaction({
        to: tokenAddress,
        data: tokenContract.interface.encodeFunctionData('approve', [
          spender,
          ethers.constants.MaxUint256
        ]),
      });

      console.log('✅ Approval transaction sent:', result);
      return true;
    } else {
      console.log('✅ Sufficient allowance already exists');
      return true;
    }
  } catch (error) {
    console.error('❌ Approval check failed:', error);
    throw error;
  }
}

export async function executeSimpleSwap(
  params: SwapParams,
  sendTransaction: any
): Promise<string> {
  const { fromToken, toToken, amountIn, userAddress, deadline = Math.floor(Date.now() / 1000) + 1200 } = params;

  try {
    console.log('🚀 Starting simple swap...', {
      from: fromToken,
      to: toToken,
      amount: amountIn,
      deadline,
    });

    // First, ensure approval for ERC20 tokens
    if (fromToken !== 'MON') {
      await checkTokenApproval(
        TOKEN_ADDRESSES[fromToken],
        userAddress,
        UNISWAP_V3_ADDRESSES.ROUTER,
        amountIn,
        sendTransaction
      );
    }

    // Create swap commands for Universal Router
    // This is a simplified version - in production you'd want to get actual quotes
    const commands = '0x00'; // V3_SWAP_EXACT_IN command
    
    // Encode swap parameters (simplified)
    const swapParams = ethers.utils.defaultAbiCoder.encode(
      ['address', 'uint256', 'uint256', 'bytes', 'bool'],
      [
        userAddress, // recipient
        amountIn, // amountIn
        '0', // minAmountOut (for demo - should calculate from quote)
        ethers.utils.solidityPack(
          ['address', 'uint24', 'address'],
          [TOKEN_ADDRESSES[fromToken], 500, TOKEN_ADDRESSES[toToken]] // 0.05% fee tier
        ), // path
        false // unwrapETH
      ]
    );

    console.log('📤 Sending swap transaction...');

    // Execute the swap
    const result = await sendTransaction({
      to: UNISWAP_V3_ADDRESSES.ROUTER,
      data: ethers.utils.concat([
        new ethers.utils.Interface(UNIVERSAL_ROUTER_ABI).encodeFunctionData('execute', [
          commands,
          [swapParams],
          deadline,
        ])
      ]),
      value: fromToken === 'MON' ? amountIn : '0',
    });

    console.log('✅ Swap transaction sent:', result);
    return result;

  } catch (error) {
    console.error('❌ Swap execution failed:', error);
    throw error;
  }
}

// Simplified swap function that works with wagmi
export async function swapTokens(
  fromToken: Token,
  toToken: Token,
  amount: string,
  userAddress: string,
  sendTransaction: any
): Promise<string> {
  return await executeSimpleSwap(
    {
      fromToken,
      toToken,
      amountIn: amount,
      userAddress,
    },
    sendTransaction
  );
} 