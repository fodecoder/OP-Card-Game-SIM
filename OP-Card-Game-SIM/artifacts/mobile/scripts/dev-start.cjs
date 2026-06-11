const { spawn } = require("child_process");
const path = require("path");

const env = { ...process.env };
env.EXPO_PUBLIC_DOMAIN = env.EXPO_PUBLIC_DOMAIN || env.REPLIT_DEV_DOMAIN || "localhost:3000";
env.EXPO_PACKAGER_PROXY_URL = env.EXPO_PACKAGER_PROXY_URL || (env.REPLIT_EXPO_DEV_DOMAIN ? `https://${env.REPLIT_EXPO_DEV_DOMAIN}` : "");
env.EXPO_PUBLIC_REPL_ID = env.EXPO_PUBLIC_REPL_ID || env.REPL_ID || "";
env.REACT_NATIVE_PACKAGER_HOSTNAME = env.REACT_NATIVE_PACKAGER_HOSTNAME || env.REPLIT_DEV_DOMAIN || "localhost";
const port = env.PORT || "3000";

env.PORT = port;
env.NODE_ENV = env.NODE_ENV || "development";

const expoCmd = path.resolve(__dirname, "..", "node_modules", ".bin", "expo.cmd");
const expoArgs = ["start", "--localhost", "--port", port];

const proc = spawn("cmd.exe", ["/c", expoCmd, ...expoArgs], {
  stdio: "inherit",
  cwd: path.resolve(__dirname, ".."),
  env,
});

proc.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code);
  }
});
