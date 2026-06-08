import fs from 'node:fs';
import path from 'node:path';

const schemaPath = path.resolve('server/db/schema.prisma');
const provider = process.argv[2];

if (provider !== 'sqlite' && provider !== 'postgresql') {
  console.error('Usage: node switch-db-provider.js <sqlite|postgresql>');
  process.exit(1);
}

try {
  let schema = fs.readFileSync(schemaPath, 'utf8');
  schema = schema.replace(/provider\s*=\s*"(sqlite|postgresql)"/, `provider = "${provider}"`);
  fs.writeFileSync(schemaPath, schema, 'utf8');
  console.log(`Database provider successfully switched to: ${provider}`);
} catch (error) {
  console.error('Failed to switch database provider:', error);
  process.exit(1);
}
