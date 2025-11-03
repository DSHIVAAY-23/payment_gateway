const { ethers } = require('ethers');

function formatToken(value, decimals = 18) {
  return ethers.utils.formatUnits(value, decimals);
}

function parseToken(valueStr, decimals = 18) {
  return ethers.utils.parseUnits(valueStr, decimals);
}

module.exports = { formatToken, parseToken };


