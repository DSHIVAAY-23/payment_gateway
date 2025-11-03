import { useEffect, useMemo, useState } from 'react';
import ConnectButton from '../components/ConnectButton';
import Checkout from '../components/Checkout';

export default function Home() {
  const [address, setAddress] = useState('');
  const [chainId, setChainId] = useState('');
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);

  const onConnect = (info) => {
    setAddress(info.address);
    setChainId(info.chainId);
    setProvider(info.provider);
    setSigner(info.signer);
  };

  return (
    <div className="container">
      <header className="header">
        <h1>Gasless Checkout Demo</h1>
      </header>
      <section className="section">
        <ConnectButton onConnect={onConnect} />
        {address && (
          <div className="meta">
            <div>Connected: {address}</div>
            <div>ChainId: {chainId}</div>
          </div>
        )}
      </section>
      <section className="section">
        <Checkout provider={provider} signer={signer} address={address} chainId={chainId} />
      </section>
      <style jsx>{`
        .container { max-width: 900px; margin: 0 auto; padding: 24px; }
        .header { display:flex; align-items:center; justify-content:space-between; }
        .section { margin-top: 24px; padding: 16px; border: 1px solid #eee; border-radius: 8px; }
        .meta { margin-top: 8px; color: #444; font-size: 14px; }
      `}</style>
    </div>
  );
}


