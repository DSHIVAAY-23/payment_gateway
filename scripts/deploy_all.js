/* eslint-disable no-console */
require('dotenv').config();
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function run(cmd, args, opts = {}) {
  console.log(`\n$ ${cmd} ${args.join(' ')}`);
  const res = spawnSync(cmd, args, { encoding: 'utf8', stdio: 'pipe', ...opts });
  if (res.error) throw res.error;
  const stdout = res.stdout || '';
  const stderr = res.stderr || '';
  if (res.status !== 0) {
    console.error(stdout);
    console.error(stderr);
    throw new Error(`${cmd} exited with code ${res.status}`);
  }
  process.stdout.write(stdout);
  return stdout;
}

function parseEvm(stdout) {
  const tokenMatch = stdout.match(/ERC20Permit deployed at:\s*(0x[a-fA-F0-9]{40})/);
  const gaslessMatch = stdout.match(/GaslessTokenTransfer deployed at:\s*(0x[a-fA-F0-9]{40})/);
  return {
    token: tokenMatch ? tokenMatch[1] : undefined,
    gasless: gaslessMatch ? gaslessMatch[1] : undefined,
  };
}

function parseSolana(stdout) {
  // Find the last occurrence of Program Id: <pubkey>
  const matches = [...stdout.matchAll(/Program Id:\s*([1-9A-HJ-NP-Za-km-z]{32,44})/g)];
  const last = matches.length ? matches[matches.length - 1][1] : undefined;
  return { programId: last };
}

async function main() {
  const outDir = path.join(process.cwd(), 'out');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'deployments.json');

  const deployer = process.env.DEPLOYER || '0x329b06f125dAFf5Bd16CCB7b3906227e50C18bB2';

  const result = {
    timestamp: new Date().toISOString(),
    deployer,
    networks: {
      sepolia: {},
      polygonAmoy: {},
      solana_devnet: { cluster: 'https://api.devnet.solana.com' }
    },
  };

  // EVM: Sepolia (only if RPC and PRIVATE_KEY present)
  if (process.env.SEPOLIA_RPC && process.env.PRIVATE_KEY) {
    try {
      const sepoliaOut = run('npx', ['hardhat', 'run', 'scripts/deploy.js', '--network', 'sepolia']);
      const sepolia = parseEvm(sepoliaOut);
      if (!sepolia.token || !sepolia.gasless) throw new Error('Failed to parse Sepolia addresses');
      result.networks.sepolia = sepolia;
    } catch (e) {
      console.error('Sepolia deploy failed:', e.message);
    }
  } else {
    console.log('Skipping Sepolia: set SEPOLIA_RPC and PRIVATE_KEY in env to enable.');
  }

  // EVM: Polygon Amoy (only if RPC and PRIVATE_KEY present)
  if (process.env.AMOY_RPC && process.env.PRIVATE_KEY) {
    try {
      const amoyOut = run('npx', ['hardhat', 'run', 'scripts/deploy.js', '--network', 'polygonAmoy']);
      const amoy = parseEvm(amoyOut);
      if (!amoy.token || !amoy.gasless) throw new Error('Failed to parse Polygon Amoy addresses');
      result.networks.polygonAmoy = amoy;
    } catch (e) {
      console.error('Polygon Amoy deploy failed:', e.message);
    }
  } else {
    console.log('Skipping Polygon Amoy: set AMOY_RPC and PRIVATE_KEY in env to enable.');
  }

  // Solana: devnet (Anchor) — If SOLANA_PROGRAM_ID is set, reuse it and skip deploy
  if (process.env.SOLANA_PROGRAM_ID) {
    console.log('Reusing existing Solana program ID from env. Skipping anchor deploy.');
    result.networks.solana_devnet.programId = process.env.SOLANA_PROGRAM_ID;
  } else {
    try {
      run('anchor', ['build']);
      const solOut = run('anchor', ['deploy', '--provider.cluster', 'devnet']);
      const sol = parseSolana(solOut);
      if (!sol.programId) throw new Error('Failed to parse Solana Program Id');
      result.networks.solana_devnet.programId = sol.programId;
    } catch (e) {
      console.error('Solana deploy failed:', e.message);
    }
  }

  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`\nSaved deployment summary -> ${outPath}`);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error('deploy_all failed:', err);
  process.exit(1);
});


