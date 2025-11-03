import { ethers } from 'ethers';
import { GASLESS_ABI } from '../../lib/ethers';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const apiKeyRequired = process.env.RELAYER_API_KEY;
    if (apiKeyRequired) {
      const provided = req.headers['x-relayer-key'];
      if (!provided || provided !== apiKeyRequired) {
        return res.status(401).json({ ok: false, error: 'Unauthorized: bad relayer key' });
      }
    }

    const RPC = process.env.LOCAL_RPC || process.env.TESTNET_RPC;
    const PK = process.env.RELAYER_PRIVATE_KEY;
    if (!RPC) return res.status(500).json({ ok: false, error: 'Missing RPC (LOCAL_RPC or TESTNET_RPC)' });
    if (!PK) return res.status(500).json({ ok: false, error: 'Missing RELAYER_PRIVATE_KEY' });

    const { token, gasless, owner, receiver, amountWei, feeWei, deadline, v, r, s } = req.body || {};
    const missing = ['token','gasless','owner','receiver','amountWei','feeWei','deadline','v','r','s'].filter(k => req.body?.[k] === undefined);
    if (missing.length) {
      return res.status(400).json({ ok: false, error: `Missing fields: ${missing.join(', ')}` });
    }

    const provider = new ethers.providers.JsonRpcProvider(RPC);
    const wallet = new ethers.Wallet(PK, provider);

    const gaslessContract = new ethers.Contract(gasless, GASLESS_ABI, wallet);

    const gasLimit = 300000; // conservative cap for demo
    const tx = await gaslessContract.send(
      token,
      owner,
      receiver,
      ethers.BigNumber.from(amountWei),
      ethers.BigNumber.from(feeWei),
      Number(deadline),
      Number(v),
      r,
      s,
      { gasLimit }
    );
    const receipt = await tx.wait();
    return res.status(200).json({ ok: true, txHash: receipt.transactionHash, blockNumber: receipt.blockNumber, receipt });
  } catch (err) {
    const msg = err?.error?.message || err?.message || String(err);
    return res.status(500).json({ ok: false, error: msg });
  }
}


