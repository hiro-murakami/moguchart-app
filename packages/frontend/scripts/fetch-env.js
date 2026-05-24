import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Update these with your specific IDs or pass them as arguments
const DEFAULT_PROJECT_ID = process.env.GCP_PROJECT_ID || '';
const DEFAULT_SECRET_NAME = 'frontend-env';

async function main() {
  const projectId = process.argv[2] || DEFAULT_PROJECT_ID;
  const secretName = process.argv[3] || DEFAULT_SECRET_NAME;

  if (!projectId) {
    console.error('Error: GCP Project ID is required. Set GCP_PROJECT_ID env var or pass it as the first argument.');
    process.exit(1);
  }

  console.log(`Fetching secret '${secretName}' from project '${projectId}'...`);

  const client = new SecretManagerServiceClient();

  try {
    const [version] = await client.accessSecretVersion({
      name: `projects/${projectId}/secrets/${secretName}/versions/latest`,
    });

    const payload = version.payload?.data?.toString();

    if (!payload) {
      throw new Error('Secret payload is empty');
    }

    let envContent = payload;

    // Try to parse as JSON to see if it's a structured secret
    try {
      const jsonPayload = JSON.parse(payload);
      // If it is JSON, convert it to .env format
      if (typeof jsonPayload === 'object' && jsonPayload !== null) {
        envContent = Object.entries(jsonPayload)
          .map(([key, value]) => `${key}="${value}"`)
          .join('\n');
      }
    } catch (e) {
      // Not JSON, treat as raw string (already in envContent)
    }

    const envPath = path.resolve(__dirname, '../.env');
    await fs.writeFile(envPath, envContent);

    console.log(`Successfully updated .env file at ${envPath}`);
  } catch (error) {
    console.error('Error fetching secret:', error);
    process.exit(1);
  }
}

main();
