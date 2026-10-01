const { spawn } = require("child_process");
const http = require("http");
const path = require("path");

function waitForServer(url, timeoutMs = 60000) {
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      http.get(url, (res) => {
        resolve();
      }).on("error", () => {
        if (Date.now() - startTime > timeoutMs) {
          reject(new Error(`Timed out waiting for server at ${url}`));
        } else {
          setTimeout(check, 500);
        }
      });
    };
    check();
  });
}

async function main() {
  console.log("🚀 Starting Next.js Production Server for Layout Audit...");
  
  const server = spawn("npx.cmd", ["next", "start", "-p", "3000"], {
    cwd: path.resolve(__dirname, ".."),
    shell: true,
    stdio: "inherit"
  });

  server.on("error", (err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });

  try {
    console.log("⏳ Waiting for Next.js server to be ready on http://localhost:3000...");
    await waitForServer("http://localhost:3000");
    console.log("✅ Next.js server is ready!");

    console.log("🎬 Running Playwright Layout Audit (R0)...");
    const audit = spawn("npx.cmd", ["tsx", "scripts/layout-audit.ts"], {
      cwd: path.resolve(__dirname, ".."),
      shell: true,
      stdio: "inherit"
    });

    audit.on("exit", (code) => {
      console.log(`\n🏁 Audit finished with code ${code}`);
      server.kill();
      // On windows, ensure child processes are killed
      spawn("taskkill", ["/pid", server.pid, "/f", "/t"], { shell: true });
      process.exit(code || 0);
    });
  } catch (err) {
    console.error("Error during audit execution:", err);
    server.kill();
    process.exit(1);
  }
}

main();
