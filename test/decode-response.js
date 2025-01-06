import { Buffer } from 'buffer';
import crypto from 'crypto';
import zlib from 'zlib';
import { readFile, writeFile } from 'fs/promises';

async function decodeResponse() {
    try {
        // Read the response file
        console.log('Reading example-response.txt...');
        const sampleData = await readFile('example-response.txt', 'utf8');
        
        // First, let's try to identify what this might be
        const keyBytes = Buffer.from(sampleData.slice(0, 32), 'hex');
        console.log('Key (hex):', keyBytes.toString('hex'));
        console.log('Key length:', keyBytes.length, 'bytes');
        
        // Try base64 decoding the rest
        const base64Part = sampleData.slice(32);
        const encryptedData = Buffer.from(base64Part, 'base64');
        console.log('\nEncrypted data length:', encryptedData.length);
        
        // Convert key to 32-bit integers
        const keyInts = [];
        for (let i = 0; i < keyBytes.length; i += 4) {
            keyInts.push(keyBytes.readUInt32BE(i));
        }
        
        console.log('\nKey as 32-bit integers:');
        keyInts.forEach((int, i) => {
            console.log(`Int ${i}: ${int} (0x${int.toString(16).padStart(8, '0')})`);
        });
        
        // Analyze relationship between key and first few blocks
        console.log('\nAnalyzing relationship between key and first few blocks...');
        
        // Get first few blocks
        const firstBlocks = [];
        for (let i = 0; i < Math.min(64, encryptedData.length); i += 4) {
            firstBlocks.push(encryptedData.readUInt32BE(i));
        }
        
        console.log('\nFirst blocks as 32-bit integers:');
        firstBlocks.forEach((int, i) => {
            console.log(`Block ${i}: ${int} (0x${int.toString(16).padStart(8, '0')})`);
        });
        
        // Try different operations between key and blocks
        console.log('\nTrying operations between key and blocks...');
        
        // For each key integer
        for (let keyIndex = 0; keyIndex < keyInts.length; keyIndex++) {
            const keyInt = keyInts[keyIndex];
            console.log(`\nKey ${keyIndex} (0x${keyInt.toString(16).padStart(8, '0')}):`);
            
            // For each block
            for (let blockIndex = 0; blockIndex < Math.min(8, firstBlocks.length); blockIndex++) {
                const blockInt = firstBlocks[blockIndex];
                
                // Try different operations
                const xor = keyInt ^ blockInt;
                const add = (keyInt + blockInt) >>> 0;
                const sub = (blockInt - keyInt) >>> 0;
                const mul = (keyInt * blockInt) >>> 0;
                const rol = ((blockInt << (keyInt & 31)) | (blockInt >>> (32 - (keyInt & 31)))) >>> 0;
                const ror = ((blockInt >>> (keyInt & 31)) | (blockInt << (32 - (keyInt & 31)))) >>> 0;
                
                console.log(`  Block ${blockIndex} (0x${blockInt.toString(16).padStart(8, '0')}):`);
                console.log(`    XOR: 0x${xor.toString(16).padStart(8, '0')}`);
                console.log(`    ADD: 0x${add.toString(16).padStart(8, '0')}`);
                console.log(`    SUB: 0x${sub.toString(16).padStart(8, '0')}`);
                console.log(`    MUL: 0x${mul.toString(16).padStart(8, '0')}`);
                console.log(`    ROL: 0x${rol.toString(16).padStart(8, '0')}`);
                console.log(`    ROR: 0x${ror.toString(16).padStart(8, '0')}`);
            }
        }
        
        // Try to find patterns in the results
        console.log('\nLooking for patterns in results...');
        
        // Try each operation as a potential decryption method
        const operations = [
            { name: 'XOR', op: (a, b) => a ^ b },
            { name: 'ADD', op: (a, b) => (a + b) >>> 0 },
            { name: 'SUB', op: (a, b) => (b - a) >>> 0 },
            { name: 'ROL', op: (a, b) => ((b << (a & 31)) | (b >>> (32 - (a & 31)))) >>> 0 },
            { name: 'ROR', op: (a, b) => ((b >>> (a & 31)) | (b << (32 - (a & 31)))) >>> 0 }
        ];
        
        // For each operation
        for (const { name, op } of operations) {
            console.log(`\nTrying ${name} operation...`);
            
            // Try each key integer as the starting point
            for (let keyStart = 0; keyStart < keyInts.length; keyStart++) {
                const decrypted = Buffer.alloc(encryptedData.length);
                
                // Process each 4-byte block
                for (let i = 0; i < encryptedData.length - 4; i += 4) {
                    const blockInt = encryptedData.readUInt32BE(i);
                    const keyInt = keyInts[(i/4 + keyStart) % keyInts.length];
                    
                    const result = op(keyInt, blockInt);
                    decrypted.writeUInt32BE(result >>> 0, i);
                }
                
                // Check for patterns in the result
                if (decrypted[0] === 0x1f && decrypted[1] === 0x8b) {
                    console.log(`Found gzip magic number with ${name} operation (key start ${keyStart})!`);
                    try {
                        const decompressed = zlib.gunzipSync(decrypted);
                        console.log('Successfully decompressed! First 200 chars:');
                        console.log(decompressed.toString('utf8').slice(0, 200));
                        
                        await writeFile('decoded_output.json', decompressed);
                        console.log('\nFull output saved to decoded_output.json');
                        return;
                    } catch (e) {
                        console.log('Failed to decompress:', e.message);
                    }
                }
                
                if (decrypted[0] === 0x7b && decrypted[1] === 0x22) {
                    console.log(`Found JSON start with ${name} operation (key start ${keyStart})!`);
                    try {
                        const text = decrypted.toString('utf8');
                        JSON.parse(text);
                        console.log('Successfully parsed as JSON! First 200 chars:');
                        console.log(text.slice(0, 200));
                        
                        await writeFile('decoded_output.json', Buffer.from(text));
                        console.log('\nFull output saved to decoded_output.json');
                        return;
                    } catch (e) {
                        console.log('Failed to parse JSON:', e.message);
                    }
                }
                
                // Also try little-endian
                const decryptedLE = Buffer.alloc(encryptedData.length);
                
                for (let i = 0; i < encryptedData.length - 4; i += 4) {
                    const blockInt = encryptedData.readUInt32LE(i);
                    const keyInt = keyInts[(i/4 + keyStart) % keyInts.length];
                    
                    const result = op(keyInt, blockInt);
                    decryptedLE.writeUInt32LE(result >>> 0, i);
                }
                
                // Check for patterns in little-endian result
                if (decryptedLE[0] === 0x1f && decryptedLE[1] === 0x8b) {
                    console.log(`Found gzip magic number with ${name} operation (LE, key start ${keyStart})!`);
                    try {
                        const decompressed = zlib.gunzipSync(decryptedLE);
                        console.log('Successfully decompressed! First 200 chars:');
                        console.log(decompressed.toString('utf8').slice(0, 200));
                        
                        await writeFile('decoded_output.json', decompressed);
                        console.log('\nFull output saved to decoded_output.json');
                        return;
                    } catch (e) {
                        console.log('Failed to decompress:', e.message);
                    }
                }
                
                if (decryptedLE[0] === 0x7b && decryptedLE[1] === 0x22) {
                    console.log(`Found JSON start with ${name} operation (LE, key start ${keyStart})!`);
                    try {
                        const text = decryptedLE.toString('utf8');
                        JSON.parse(text);
                        console.log('Successfully parsed as JSON! First 200 chars:');
                        console.log(text.slice(0, 200));
                        
                        await writeFile('decoded_output.json', Buffer.from(text));
                        console.log('\nFull output saved to decoded_output.json');
                        return;
                    } catch (e) {
                        console.log('Failed to parse JSON:', e.message);
                    }
                }
            }
        }
        
        console.log('\nNo successful decryption found');
        
    } catch (error) {
        console.error('Error processing data:', error);
    }
}

// Run the decoder
decodeResponse()
    .then(() => console.log('Done!'))
    .catch(error => console.error('Fatal error:', error)); 