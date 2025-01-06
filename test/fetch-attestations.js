import fetch from 'node-fetch';
import { writeFile } from 'fs/promises';

const EAS_SCHEMA_UID = '0xcb66276cf243e78fad68dd5e633f7bb56814b49ac9a91256615340591577a0e8';
const GRAPHQL_ENDPOINT = 'https://base.easscan.org/graphql';

async function fetchAttestations() {
  try {
    let allAttestations = [];
    let hasMore = true;
    let offset = 0;
    const limit = 100;

    while (hasMore) {
      const query = `
        query GetAttestations {
          attestations(
            where: {
              schemaId: {
                equals: "${EAS_SCHEMA_UID}"
              }
            },
            orderBy: { time: desc },
            take: ${limit},
            skip: ${offset}
          ) {
            id
            attester
            recipient
            refUID
            revocationTime
            time
            decodedDataJson
          }
        }
      `;

      const response = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query })
      });

      const data = await response.json();
      const attestations = data.data.attestations;
      
      if (attestations.length === 0) {
        hasMore = false;
      } else {
        // Process the attestations
        const processedAttestations = attestations.map(attestation => {
          const decodedData = JSON.parse(attestation.decodedDataJson);
          return {
            uid: attestation.id,
            timestamp: attestation.time,
            twitterUserId: BigInt(decodedData[0].value.value.hex).toString(),
            twitterUsername: decodedData[1].value.value,
            yapPoints: BigInt(decodedData[2].value.value.hex).toString()
          };
        });

        allAttestations = [...allAttestations, ...processedAttestations];
        console.log(`Fetched ${allAttestations.length} attestations so far...`);
        offset += limit;
      }
    }

    // Create the full data cache
    const cacheData = {
      timestamp: Date.now(),
      attestations: allAttestations
    };

    // Create optimized version
    const optimizedData = allAttestations.map(({ twitterUsername, yapPoints }) => [
      twitterUsername,
      yapPoints
    ]);

    console.log('\nSample attestation (full):', allAttestations[0]);
    console.log('Sample attestation (optimized):', optimizedData[0]);
    console.log('Total attestations:', allAttestations.length);
    
    // Save both versions
    await writeFile('attestations.json', JSON.stringify(cacheData, null, 2));
    await writeFile('attestations_optimized.json', JSON.stringify({
      t: Date.now(),
      a: optimizedData
    }));

    const fullSize = JSON.stringify(cacheData).length;
    const optimizedSize = JSON.stringify({t: Date.now(), a: optimizedData}).length;
    const savings = ((fullSize - optimizedSize) / fullSize * 100).toFixed(2);
    
    console.log('\nData saved to attestations.json and attestations_optimized.json');
    console.log(`Size comparison: ${(fullSize/1024).toFixed(2)}KB vs ${(optimizedSize/1024).toFixed(2)}KB (${savings}% smaller)`);
    
    return { cacheData, optimizedData };

  } catch (error) {
    console.error('Error fetching attestations:', error);
    throw error;
  }
}

// Run directly if called as script
if (import.meta.url === new URL(import.meta.url).href) {
  fetchAttestations()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

export { fetchAttestations }; 