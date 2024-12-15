import { exec } from 'child_process';

const otherScripts = [
    'node inkchain.js',
];

function clearConsole() {
  console.clear();
  console.log("======================================================");
  console.log("\x1b[38;5;213mBY: wrightL\x1b[0m");
  console.log("\x1b[38;5;117mGITHUB: https://github.com/wrightL-dev\x1b[0m");
  console.log("\x1b[38;5;159mTELEGRAM CHANNEL: https://t.me/tahuri01\x1b[0m");
  console.log("==================== BOT INKCHAIN ====================");
  console.log("\x1b[38;5;82m[ ✔️ ] BOT STATUS: \x1b[38;5;46mRUNNING\x1b[0m");
  console.log("======================================================");
  console.log("\x1b[38;5;214m[ ⚠️ ] NOTE: Jangan lupa /start dahulu di bot sebelum menjalankan ini!\x1b[0m");
}

function runScripts(scripts) {
    scripts.forEach(script => {
        exec(script, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing ${script}:`, error);
                return;
            }
            if (stderr) {
                console.error(`stderr: ${stderr}`);
                return;
            }
            console.log(`Output of ${script}:\n${stdout}`);
        });
    });
}

function startIntervals() {
    clearConsole();
    runScripts(otherScripts);
}

startIntervals();
