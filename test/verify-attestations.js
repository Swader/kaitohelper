import 'dotenv/config';
import { ethers } from 'ethers';
import fetch from 'node-fetch';

async function getIPFSHashFromENS() {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const ensName = process.env.ENS_NAME;
    
    console.log(`Getting resolver for ${ensName}...`);
    const resolver = await provider.getResolver(ensName);
    if (!resolver) {
      throw new Error(`No resolver found for ${ensName}`);
    }

    console.log('Getting kaito-scores text record...');
    const hash = await resolver.getText('kaito-scores');
    if (!hash) {
      throw new Error('No kaito-scores record found');
    }

    return hash;
  } catch (error) {
    console.error('Error getting IPFS hash from ENS:', error);
    throw error;
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getAttestationsFromIPFS(ipfsHash) {
  // Try multiple IPFS gateways in case one fails
  const gateways = [
    'https://ipfs.filebase.io/ipfs/',
    'https://ipfs.io/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/'
  ];

  // Try up to 3 times with increasing delays
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (attempt > 1) {
      const delay = attempt * 5000; // 5s, 10s, 15s delays
      console.log(`\nAttempt ${attempt}/3 - Waiting ${delay/1000}s for IPFS propagation...`);
      await sleep(delay);
    }

    for (const gateway of gateways) {
      try {
        console.log(`Trying gateway: ${gateway}...`);
        const response = await fetch(`${gateway}${ipfsHash}`);
        
        if (!response.ok) {
          const text = await response.text();
          console.log(`Gateway ${gateway} returned status ${response.status}:`, 
            text.substring(0, 200) + (text.length > 200 ? '...' : ''));
          continue; // Try next gateway
        }
        
        const data = await response.json();
        console.log(`Successfully retrieved data from ${gateway}`);
        return data;
      } catch (error) {
        console.log(`Gateway ${gateway} failed:`, error.message);
        continue; // Try next gateway
      }
    }
    
    if (attempt === 3) {
      throw new Error('All gateways failed after 3 attempts');
    }
    console.log('All gateways failed this attempt, will retry after delay...');
  }
}

async function verify() {
  try {
    // Get IPFS hash from ENS
    console.log('Getting IPFS hash from ENS...');
    const ipfsHash = await getIPFSHashFromENS();
    console.log('IPFS hash:', ipfsHash);

    // Get attestations from IPFS
    console.log('\nGetting attestations from IPFS...');
    const data = await getAttestationsFromIPFS(ipfsHash);
    
    // Verify the data
    console.log('\nVerifying attestations data...');
    if (!data.attestations || !Array.isArray(data.attestations)) {
      throw new Error('Invalid attestations data format');
    }

    console.log(`Successfully retrieved ${data.attestations.length} attestations`);
    console.log('Last updated:', new Date(data.timestamp).toLocaleString());
    
    return data;
  } catch (error) {
    console.error('Verification failed:', error);
    throw error;
  }
}

// Only run if called directly
if (import.meta.url === new URL(import.meta.url).href) {
  verify()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

export { verify }; 