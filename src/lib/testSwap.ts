import { type Token } from './constants';

// Test swap function that just logs the swap attempt
export async function testSwapTokens(
  fromToken: Token,
  toToken: Token,
  amount: string,
  userAddress: string,
  sendTransaction: any
): Promise<string> {
  console.log('🧪 TEST SWAP FUNCTION CALLED!', {
    fromToken,
    toToken,
    amount,
    userAddress,
    timestamp: new Date().toISOString(),
    message: 'This confirms the swap function is being triggered when towers are hit!'
  });

  // Simulate a delay like a real transaction
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Return a fake transaction hash
  const fakeHash = '0x' + Math.random().toString(16).substring(2, 66);
  console.log('🎯 TEST SWAP COMPLETED', { fakeHash });
  
  return fakeHash;
} 