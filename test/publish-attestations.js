import 'dotenv/config';
import { ethers } from 'ethers';
import { readFile } from 'fs/promises';
import { ObjectManager } from "@filebase/sdk";

async function uploadToFilebase(data) {
  try {
    const objectManager = new ObjectManager(
      process.env.FILEBASE_ACCESS_KEY,
      process.env.FILEBASE_SECRET_KEY,
      {
        bucket: "brunobuilds"
      }
    );

    console.log('Uploading file to Filebase...');
    const uploadedObject = await objectManager.upload(
      "attestations.json",
      Buffer.from(JSON.stringify(data))
    );

    console.log('Upload response:', uploadedObject);

    if (!uploadedObject?.cid) {
      console.log('Full response:', JSON.stringify(uploadedObject, null, 2));
      throw new Error('No CID found in response');
    }

    console.log('Upload successful:', {
      cid: uploadedObject.cid,
      name: uploadedObject.name
    });

    return uploadedObject.cid;
  } catch (error) {
    console.error('Error uploading to Filebase:', error);
    throw error;
  }
}

async function loadLocalAttestations() {
  try {
    const data = await readFile('attestations.json', 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error('No attestations.json file found. Please run "npm run fetch" first to fetch attestations.');
    }
    throw error;
  }
}

async function updateENS(ipfsHash) {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const ensName = process.env.ENS_NAME;
    
    // Get the resolver
    const resolver = await provider.getResolver(ensName);
    if (!resolver) {
      throw new Error(`No resolver found for ${ensName}`);
    }

    // Check current hash
    const currentHash = await resolver.getText('kaito-scores');
    if (currentHash === ipfsHash) {
      console.log('ENS record already contains this IPFS hash. Skipping update.');
      return false;
    }

    // Create a contract instance for the resolver
    const resolverInterface = new ethers.Interface([
      "function setText(bytes32 node, string calldata key, string calldata value) external"
    ]);
    const resolverContract = new ethers.Contract(
      resolver.address,
      resolverInterface,
      wallet
    );

    // Update the text record
    console.log('Updating ENS record...');
    const tx = await resolverContract.setText(
      ethers.namehash(ensName),
      'kaito-scores',
      ipfsHash,
      { gasLimit: 100000 }
    );
    
    await tx.wait();
    console.log('ENS record updated successfully');
    return true;
  } catch (error) {
    console.error('Error updating ENS:', error);
    throw error;
  }
}

async function publish() {
  try {
    // Load local attestations
    console.log('Loading local attestations...');
    const data = await loadLocalAttestations();
    console.log(`Loaded ${data.attestations.length} attestations from file`);
    console.log('Last updated:', new Date(data.timestamp).toLocaleString());
    
    // Upload to Filebase
    console.log('\nUploading to Filebase...');
    const cid = await uploadToFilebase(data);
    console.log('Published to IPFS:', cid);
    
    // Update ENS if needed
    console.log('\nChecking if ENS update is needed...');
    const updated = await updateENS(cid);
    if (updated) {
      console.log('Process completed with ENS update!');
    } else {
      console.log('Process completed without ENS update (same hash)');
    }
    
    return cid;
  } catch (error) {
    console.error('Error in publish process:', error);
    throw error;
  }
}

// Only run if called directly
if (import.meta.url === new URL(import.meta.url).href) {
  publish()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

export { publish }; 