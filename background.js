import { ethers } from 'ethers';

// Constants
const CACHE_DURATION = 5 * 24 * 60 * 60 * 1000; // 5 days in milliseconds
const ENS_NAME = 'kaito-attestations.webfree.eth';
const GATEWAYS = [
  'https://ipfs.filebase.io/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/'
];

// Utility function to fetch with timeout
async function fetchWithTimeout(url, timeout = 5000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function getIPFSData(ipfsHash) {
  for (const gateway of GATEWAYS) {
    try {
      const response = await fetchWithTimeout(`${gateway}${ipfsHash}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.log(`Gateway ${gateway} failed:`, error.message);
      continue;
    }
  }
  throw new Error('All gateways failed');
}

async function getLatestData(forceFetch = false) {
  try {
    // Check cache first unless force fetch
    if (!forceFetch) {
      const cache = await chrome.storage.local.get(['yapScores', 'lastUpdated']);
      const now = Date.now();
      
      if (cache.yapScores && cache.lastUpdated && (now - cache.lastUpdated < CACHE_DURATION)) {
        console.log('Using cached data from:', new Date(cache.lastUpdated).toLocaleString());
        return cache.yapScores;
      }
    }

    // Get IPFS hash from ENS
    const provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
    const resolver = await provider.getResolver(ENS_NAME);
    if (!resolver) {
      throw new Error('No ENS resolver found');
    }
    
    const ipfsHash = await resolver.getText('kaito-scores');
    if (!ipfsHash) {
      throw new Error('No IPFS hash found in ENS record');
    }

    // Fetch from IPFS
    const data = await getIPFSData(ipfsHash);
    
    // Update cache
    await chrome.storage.local.set({ 
      yapScores: data,
      lastUpdated: Date.now()
    });
    
    console.log('Cache updated with new data');
    return data;
  } catch (error) {
    console.error('Error fetching latest data:', error);
    
    // Fall back to cached data if available
    const cache = await chrome.storage.local.get(['yapScores', 'lastUpdated']);
    if (cache.yapScores) {
      console.log('Using cached data due to fetch error');
      return cache.yapScores;
    }
    
    // If no cache, return empty data structure
    return { attestations: [], timestamp: 0 };
  }
}

// Set up initial data fetch when extension loads
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed, fetching initial data...');
  getLatestData(true);
});

// Set up periodic cache updates
chrome.alarms.create('updateYapScores', { 
  periodInMinutes: 60 * 24 // Check daily
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'updateYapScores') {
    console.log('Daily check for new data...');
    getLatestData();
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'getYapScores') {
    getLatestData()
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Will respond asynchronously
  }
}); 