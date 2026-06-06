const fs = require("fs");
const net = require("net");
const path = require("path");
const crypto = require("crypto");
const bser = require("../apps/askbible-mobile/node_modules/bser");

const socketPath = "/private/tmp/askbible-watchman.sock";
const rootSet = new Set();
const subscriptions = new Map();

function removeSocketIfPresent() {
  try {
    fs.unlinkSync(socketPath);
  } catch {}
}

function watchmanBinaryResponse(argv) {
  const command = argv[0];
  if (command === "list-capabilities") {
    process.stdout.write(
      JSON.stringify({
        version: "2026.05.25.00",
        capabilities: [
          "cmd-watch-project",
          "relative_root",
          "suffix-set",
          "wildmatch",
          "field-content.sha1hex",
        ],
      }),
    );
    return;
  }
  if (command === "version") {
    process.stdout.write(JSON.stringify({ version: "2026.05.25.00" }));
    return;
  }
  if (command === "get-sockname") {
    process.stdout.write(JSON.stringify({ sockname: socketPath }));
    return;
  }
  process.stderr.write(`Unsupported watchman command: ${command}\n`);
  process.exitCode = 1;
}

function absoluteToNormal(rootDir, filePath) {
  return path.relative(rootDir, filePath).split(path.sep).join("/");
}

function walkFiles(rootDir) {
  const out = [];
  const stack = [rootDir];
  while (stack.length) {
    const dir = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === ".git") continue;
        stack.push(full);
      } else if (entry.isSymbolicLink() || entry.isFile()) {
        out.push(full);
      }
    }
  }
  return out;
}

function fileMetadata(fullPath) {
  try {
    const stat = fs.lstatSync(fullPath);
    return {
      name: fullPath,
      exists: true,
      type: stat.isSymbolicLink() ? "l" : "f",
      size: stat.size,
      mtime_ms: stat.mtimeMs,
    };
  } catch {
    return {
      name: fullPath,
      exists: false,
    };
  }
}

function makeClock(rootDir) {
  return `${rootDir}:${Date.now()}`;
}

function startServer() {
  removeSocketIfPresent();
  const server = net.createServer((socket) => {
    const bunser = new bser.BunserBuf();
    let connectedRoot = null;

    bunser.on("value", (cmd) => {
      if (!Array.isArray(cmd) || cmd.length === 0) {
        socket.write(bser.dumpToBuffer({ error: "bad command" }));
        return;
      }
      const [name, ...args] = cmd;
      if (name === "watch-project") {
        const rootDir = args[0];
        connectedRoot = rootDir;
        rootSet.add(rootDir);
        socket.write(
          bser.dumpToBuffer({
            watch: rootDir,
            relative_path: "",
            watcher: "mock",
          }),
        );
        return;
      }
      if (name === "clock") {
        const rootDir = args[0];
        socket.write(bser.dumpToBuffer({ clock: makeClock(rootDir) }));
        return;
      }
      if (name === "query") {
        const rootDir = args[0];
        const files = walkFiles(rootDir).map((fullPath) => {
          const stat = fs.lstatSync(fullPath);
          return {
            name: absoluteToNormal(rootDir, fullPath),
            exists: true,
            type: stat.isSymbolicLink() ? "l" : "f",
            size: stat.size,
            mtime_ms: stat.mtimeMs,
          };
        });
        socket.write(
          bser.dumpToBuffer({
            is_fresh_instance: false,
            files,
            clock: makeClock(rootDir),
          }),
        );
        return;
      }
      if (name === "subscribe") {
        const rootDir = args[0];
        const subName = args[1];
        subscriptions.set(subName, { rootDir, socket });
        socket.write(bser.dumpToBuffer({ subscribe: subName }));
        return;
      }
      socket.write(bser.dumpToBuffer({ error: `unsupported command: ${name}` }));
    });

    bunser.on("error", (err) => {
      socket.destroy(err);
    });

    socket.on("data", (buf) => bunser.append(buf));
    socket.on("close", () => {
      if (connectedRoot) {
        rootSet.delete(connectedRoot);
      }
      for (const [name, entry] of subscriptions.entries()) {
        if (entry.socket === socket) {
          subscriptions.delete(name);
        }
      }
    });
  });

  server.listen(socketPath, () => {
    fs.chmodSync(socketPath, 0o777);
    process.stdout.write(`${socketPath}\n`);
  });

  const pollMs = 1000;
  const lastSnapshots = new Map();
  setInterval(() => {
    for (const [subName, entry] of subscriptions.entries()) {
      const files = walkFiles(entry.rootDir);
      const snapshot = files
        .map((fullPath) => {
          try {
            const stat = fs.lstatSync(fullPath);
            return `${absoluteToNormal(entry.rootDir, fullPath)}:${stat.mtimeMs}:${stat.size}`;
          } catch {
            return null;
          }
        })
        .filter(Boolean)
        .join("|");
      if (lastSnapshots.get(subName) === snapshot) continue;
      lastSnapshots.set(subName, snapshot);
      const filesPayload = files.map((fullPath) => fileMetadata(fullPath));
      entry.socket.write(
        bser.dumpToBuffer({
          subscription: subName,
          files: filesPayload,
          clock: makeClock(entry.rootDir),
        }),
      );
    }
  }, pollMs).unref();
}

if (process.argv[2] && process.argv[2] !== "--server") {
  watchmanBinaryResponse(process.argv.slice(2));
} else {
  startServer();
}
