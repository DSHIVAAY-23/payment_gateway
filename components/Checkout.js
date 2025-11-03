import { useCallback, useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { ERC20_ABI, toWei } from '../lib/ethers';

export default function Checkout({ provider, signer, address, chainId }) {
  const [token, setToken] = useState(process.env.NEXT_PUBLIC_TOKEN_ADDRESS || '');
  const [gasless, setGasless] = useState(process.env.NEXT_PUBLIC_GASLESS_ADDRESS || '');
  const [receiver, setReceiver] = useState(address || '');
  const [amount, setAmount] = useState('10.0');
  const [fee, setFee] = useState('0.1');
  const [deadlineMin, setDeadlineMin] = useState(60);
  const [tokenName, setTokenName] = useState('');
  const [nonce, setNonce] = useState('');
  const [sig, setSig] = useState(null);
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (address) setReceiver(address); }, [address]);

  const appendLog = (entry) => setLog((prev) => [...prev, entry]);

  const fetchMeta = useCallback(async () => {
    try {
      if (!signer || !address) throw new Error('Connect wallet first');
      if (!token || !ethers.utils.isAddress(token)) throw new Error('Invalid token address');
      setLoading(true);
      const tokenC = new ethers.Contract(token, ERC20_ABI, signer);
      const [name, n] = await Promise.all([
        tokenC.name(),
        tokenC.nonces(address)
      ]);
      setTokenName(name);
      setNonce(n.toString());
      appendLog({ level: 'info', msg: `Token ${name}, nonce ${n.toString()}` });
    } catch (e) {
      appendLog({ level: 'error', msg: e.message || String(e) });
    } finally {
      setLoading(false);
    }
  }, [signer, address, token]);

  const signPermit = useCallback(async () => {
    try {
      if (!signer || !address) throw new Error('Connect wallet first');
      if (!token || !ethers.utils.isAddress(token)) throw new Error('Invalid token address');
      if (!gasless || !ethers.utils.isAddress(gasless)) throw new Error('Invalid gasless contract address');
      if (!receiver || !ethers.utils.isAddress(receiver)) throw new Error('Invalid receiver address');
      if (!amount || parseFloat(amount) <= 0) throw new Error('Invalid amount');
      if (!fee || parseFloat(fee) < 0) throw new Error('Invalid fee');
      setLoading(true);
      // Read fresh nonce just before signing
      const tokenC = new ethers.Contract(token, ERC20_ABI, signer);
      const name = await tokenC.name();
      const currentNonce = await tokenC.nonces(address);

      const decimals = 18; // demo token
      const amountWei = toWei(amount, decimals);
      const feeWei = toWei(fee, decimals);
      const value = amountWei.add(feeWei);
      const deadline = Math.floor(Date.now() / 1000) + Number(deadlineMin) * 60;

      const domain = {
        name,
        version: '1',
        chainId: Number(chainId),
        verifyingContract: token
      };
      const types = {
        Permit: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' }
        ]
      };
      const message = {
        owner: address,
        spender: gasless,
        value: value.toString(),
        nonce: currentNonce.toString(),
        deadline
      };

      const signature = await signer._signTypedData(domain, types, message);
      const { v, r, s } = ethers.utils.splitSignature(signature);

      const payload = {
        token,
        gasless,
        owner: address,
        receiver,
        amountWei: amountWei.toString(),
        feeWei: feeWei.toString(),
        deadline,
        v, r, s
      };
      setSig(payload);
      appendLog({ level: 'info', msg: 'Signed permit', details: { v, r, s, deadline } });
    } catch (e) {
      appendLog({ level: 'error', msg: e.message || String(e) });
    } finally {
      setLoading(false);
    }
  }, [signer, address, token, gasless, receiver, amount, fee, deadlineMin, chainId]);

  const sendToRelayer = useCallback(async () => {
    try {
      if (!sig) throw new Error('Sign permit first');
      setLoading(true);
      const headers = { 'Content-Type': 'application/json' };
      if (process.env.NEXT_PUBLIC_RELAYER_API_KEY) headers['x-relayer-key'] = process.env.NEXT_PUBLIC_RELAYER_API_KEY;
      const resp = await fetch('/api/relay', { method: 'POST', headers, body: JSON.stringify(sig) });
      const data = await resp.json();
      if (!resp.ok || !data.ok) throw new Error(data.error || 'Relayer failed');
      appendLog({ level: 'success', msg: `Tx: ${data.txHash} (block ${data.blockNumber})` });
      setSig(null); // Reset signature after successful relay
    } catch (e) {
      appendLog({ level: 'error', msg: e.message || String(e) });
    } finally {
      setLoading(false);
    }
  }, [sig]);

  return (
    <div>
      <div className="grid">
        <label>Token address
          <input value={token} onChange={(e)=>setToken(e.target.value)} placeholder="0x..." />
        </label>
        <label>Gasless contract
          <input value={gasless} onChange={(e)=>setGasless(e.target.value)} placeholder="0x..." />
        </label>
        <label>Receiver
          <input value={receiver} onChange={(e)=>setReceiver(e.target.value)} placeholder="0x..." />
        </label>
        <label>Amount
          <input type="number" step="0.01" min="0" value={amount} onChange={(e)=>setAmount(e.target.value)} />
        </label>
        <label>Fee
          <input type="number" step="0.01" min="0" value={fee} onChange={(e)=>setFee(e.target.value)} />
        </label>
        <label>Deadline (minutes)
          <input type="number" min="1" value={deadlineMin} onChange={(e)=>setDeadlineMin(Number(e.target.value))} />
        </label>
      </div>
      <div className="row">
        <button onClick={fetchMeta} disabled={loading || !signer}>Fetch nonce & token name</button>
        <button onClick={signPermit} disabled={loading || !signer}>Sign Permit</button>
        <button onClick={sendToRelayer} disabled={loading || !sig}>Send to Relayer</button>
      </div>
      <div className="info">
        <div>Token Name: {tokenName}</div>
        <div>Nonce: {nonce}</div>
      </div>
      <div className="logs">
        {log.map((l, i) => (
          <div key={i} className={`log ${l.level}`}>{l.level.toUpperCase()}: {l.msg}</div>
        ))}
      </div>
      <style jsx>{`
        .grid { display:grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        label { display:flex; flex-direction:column; font-size: 14px; gap:6px; }
        input { padding:8px; border:1px solid #ddd; border-radius:6px; }
        .row { margin-top:16px; display:flex; gap:10px; }
        button { padding:10px 14px; border-radius:6px; border:1px solid #ddd; background:#fafafa; cursor:pointer; }
        button:hover { background:#f1f1f1; }
        button:disabled { opacity:0.5; cursor:not-allowed; background:#eee; }
        .info { margin-top:12px; color:#444; }
        .logs { margin-top:16px; font-family: monospace; }
        .log { padding:6px 8px; border-left:3px solid #ddd; margin-bottom:6px; background:#fbfbfb; }
        .log.error { border-color:#e00; }
        .log.success { border-color:#0a0; }
        .log.info { border-color:#09f; }
      `}</style>
    </div>
  );
}


