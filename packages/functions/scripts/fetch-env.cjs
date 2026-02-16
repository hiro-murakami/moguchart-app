const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const fs = require('fs').promises;
const path = require('path');

// Update these with your specific IDs or pass them as arguments
const DEFAULT_PROJECT_ID = 'firestore-sample-c7300';
const DEFAULT_SECRET_NAME = 'functions-env';

async function main() {
  const projectId = process.argv[2] || DEFAULT_PROJECT_ID;
  const secretName = process.argv[3] || DEFAULT_SECRET_NAME;

  console.log(`Fetching secret '${secretName}' from project '${projectId}' (functions)...`);

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
    if (error.code === 5 || (error.message && (error.message.includes('NOT_FOUND') || error.message.includes('PERMISSION_DENIED')))) {
      console.warn(`[WARNING] Could not fetch secret '${secretName}'. Make sure it exists and you have permission.`);
      console.warn('Skipping .env update. Please ensure .env exists locally for development.');
      // Do not fail the build/setup if secret is missing, just warn, as local dev might have .env already.
      // But for CI/CD it might be critical. Let's exit 0 to allow local dev to proceed if they have .env manually.
      process.exit(0);
    } else {
      console.error('Error fetching secret:', error);
      process.exit(1);
    }
  }
}

main();
