import { useEffect, useState } from 'react';
import { ethers } from 'ethers';

export default function ConnectButton({ onConnect }) {
  const [address, setAddress] = useState('');
  const [chainId, setChainId] = useState('');

  const connect = async () => {
    if (!window.ethereum) {
      alert('MetaMask not found');
      return;
    }
    const provider = new ethers.providers.Web3Provider(window.ethereum, 'any');
    await provider.send('eth_requestAccounts', []);
    const signer = provider.getSigner();
    const addr = await signer.getAddress();
    const network = await provider.getNetwork();
    setAddress(addr);
    setChainId(String(network.chainId));
    onConnect && onConnect({ provider, signer, address: addr, chainId: String(network.chainId) });
  };

  useEffect(() => {
    if (!window.ethereum) return;
    const handlerAccounts = (accs) => {
      if (accs && accs.length > 0) {
        setAddress(accs[0]);
      } else {
        setAddress('');
      }
      if (onConnect && window.ethereum.selectedAddress) {
        const provider = new ethers.providers.Web3Provider(window.ethereum, 'any');
        const signer = provider.getSigner();
        signer.getAddress().then((addr) => {
          provider.getNetwork().then((net) => {
            onConnect({ provider, signer, address: addr, chainId: String(net.chainId) });
          });
        });
      }
    };
    const handlerChain = (_chainId) => {
      setChainId(String(parseInt(_chainId, 16)));
      window.location.reload();
    };
    window.ethereum.on('accountsChanged', handlerAccounts);
    window.ethereum.on('chainChanged', handlerChain);
    return () => {
      try {
        window.ethereum.removeListener('accountsChanged', handlerAccounts);
        window.ethereum.removeListener('chainChanged', handlerChain);
      } catch {}
    };
  }, [onConnect]);

  return (
    <button onClick={connect} className="btn">
      {address ? `Connected: ${address.substring(0, 6)}...${address.slice(-4)}` : 'Connect Wallet'}
      <style jsx>{`
        .btn { padding: 10px 16px; background:#111; color:#fff; border:none; border-radius:8px; cursor:pointer; }
        .btn:hover { background:#333; }
      `}</style>
    </button>
  );
}


