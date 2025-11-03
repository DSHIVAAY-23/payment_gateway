import { ethers } from 'ethers';

export const ERC20_ABI = [
  'function name() view returns (string)',
  'function nonces(address) view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

export const GASLESS_ABI = [
  'function send(address token,address sender,address receiver,uint256 amount,uint256 fee,uint256 deadline,uint8 v,bytes32 r,bytes32 s) external'
];

export function toWei(valueStr, decimals = 18) {
  return ethers.utils.parseUnits(valueStr || '0', decimals);
}

export function fromWei(bn, decimals = 18) {
  return ethers.utils.formatUnits(bn || 0, decimals);
}


