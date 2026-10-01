const { spawnSync } = require('child_process');

const javaHome = 'C:\\Users\\nanon\\jdk21_java\\jdk-21.0.12.1+1';
const env = {
  ...process.env,
  JAVA_HOME: javaHome,
  PATH: `${javaHome}\\bin;${process.env.PATH}`
};

console.log('🚀 Launching Firebase Firestore Emulator for P2 Test Suite...');
const result = spawnSync('npx.cmd', ['firebase', 'emulators:exec', '--only', 'firestore', '"npx tsx scripts/test-p2-defaults-and-stock.ts"'], {
  env,
  stdio: 'inherit',
  shell: true
});

process.exit(result.status || 0);
