import fetch from 'node-fetch';

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
            twitterUserId: BigInt(decodedData[0].value.value.hex).toString(), // Convert BigNumber to string
            twitterUsername: decodedData[1].value.value,
            yapPoints: BigInt(decodedData[2].value.value.hex).toString() // Convert BigNumber to string
          };
        });

        allAttestations = [...allAttestations, ...processedAttestations];
        console.log(`Fetched ${allAttestations.length} attestations so far...`);
        offset += limit;
      }
    }

    // Cache the results
    const cacheData = {
      timestamp: Date.now(),
      attestations: allAttestations
    };

    console.log('\nSample attestation:', allAttestations[0]);
    console.log('Total attestations:', allAttestations.length);
    
    // Save to file for inspection
    const fs = await import('fs');
    await fs.promises.writeFile('attestations.json', JSON.stringify(cacheData, null, 2));
    console.log('\nData saved to attestations.json');
    
    return cacheData;

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