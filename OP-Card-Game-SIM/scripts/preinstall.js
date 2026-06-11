const fs = require('fs');
const path = require('path');
const execSync = require('child_process').execSync;

const root = path.resolve(__dirname, '..');
const lockFiles = ['package-lock.json', 'yarn.lock'];

for (const file of lockFiles) {
  const p = path.join(root, file);
  if (fs.existsSync(p)) {
    try {
      fs.unlinkSync(p);
      console.log(`Removed ${file}`);
    } catch (err) {
      console.error(`Failed to remove ${file}:`, err);
      process.exit(1);
    }
  }
}

const npmUserAgent = process.env.npm_config_user_agent || '';
if (!npmUserAgent.startsWith('pnpm/')) {
  console.error('Use pnpm instead');
  process.exit(1);
}

process.exit(0);
