import { Client, type ConnectConfig } from "ssh2";
import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { buildVisibleExecutionCommand, parseVisibleExecutionOutput } from "./visibleExecution";

interface SshSessionOptions {
  sessionId: string;
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

interface SshSession {
  client: Client;
  stream: import("ssh2").ClientChannel | null;
}

const UNIVERSAL_SSH_ALGORITHMS: ConnectConfig["algorithms"] = {
  kex: [
    "curve25519-sha256",
    "curve25519-sha256@libssh.org",
    "ecdh-sha2-nistp256",
    "ecdh-sha2-nistp384",
    "ecdh-sha2-nistp521",
    "diffie-hellman-group-exchange-sha256",
    "diffie-hellman-group14-sha256",
    "diffie-hellman-group14-sha1",
    "diffie-hellman-group1-sha1",
    "diffie-hellman-group-exchange-sha1"
  ],
  cipher: [
    "aes128-gcm",
    "aes128-gcm@openssh.com",
    "aes256-gcm",
    "aes256-gcm@openssh.com",
    "aes128-ctr",
    "aes192-ctr",
    "aes256-ctr",
    "aes128-cbc",
    "aes192-cbc",
    "aes256-cbc",
    "3des-cbc"
  ],
  serverHostKey: [
    "ssh-ed25519",
    "ecdsa-sha2-nistp256",
    "ecdsa-sha2-nistp384",
    "ecdsa-sha2-nistp521",
    "rsa-sha2-512",
    "rsa-sha2-256",
    "ssh-rsa",
    "ssh-dss"
  ],
  hmac: [
    "hmac-sha2-256-etm@openssh.com",
    "hmac-sha2-512-etm@openssh.com",
    "hmac-sha2-256",
    "hmac-sha2-512",
    "hmac-sha1",
    "hmac-sha1-96"
  ]
};

function attachKeyboardInteractiveHandler(client: Client, password?: string) {
  client.on("keyboard-interactive", (_name, _instructions, _instructionsLang, prompts, finish) => {
    if (password) {
      if (prompts.length === 0) {
        finish([password]);
      } else {
        finish(prompts.map(() => password));
      }
    } else {
      finish([]);
    }
  });
}

class SshManager extends EventEmitter {
  private sessions = new Map<string, SshSession>();

  connect(options: SshSessionOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      const client = new Client();

      const config: ConnectConfig = {
        host: options.host,
        port: options.port,
        username: options.username,
        readyTimeout: 15000,
        keepaliveInterval: 10000,
        keepaliveCountMax: 3,
        tryKeyboard: true,
        algorithms: UNIVERSAL_SSH_ALGORITHMS,
        authHandler: (methodsLeft, _partialSuccess, cb) => {
          const methods = Array.isArray(methodsLeft) ? methodsLeft : [];
          if (options.password && methods.includes("keyboard-interactive")) {
            cb("keyboard-interactive");
          } else if (options.password && methods.includes("password")) {
            cb("password");
          } else if (options.privateKey && methods.includes("publickey")) {
            cb("publickey");
          } else if (methods.length > 0) {
            cb(methods[0] as any);
          } else {
            cb(options.password ? "password" : "keyboard-interactive");
          }
        }
      };

      if (options.privateKey) {
        config.privateKey = options.privateKey;
        if (options.passphrase) config.passphrase = options.passphrase;
      }
      if (options.password) {
        config.password = options.password;
      }

      attachKeyboardInteractiveHandler(client, options.password);

      client.on("banner", (message) => {
        this.emit("data", options.sessionId, message.replace(/\r?\n/g, "\r\n"));
      });

      client.on("ready", () => {
        client.shell({ term: "xterm-256color" }, (err, stream) => {
          if (err) {
            reject(err);
            return;
          }

          this.sessions.set(options.sessionId, { client, stream });

          stream.on("data", (data: Buffer) => {
            this.emit("data", options.sessionId, data.toString("utf-8"));
          });

          stream.on("close", () => {
            this.emit("closed", options.sessionId);
            this.disconnect(options.sessionId);
          });

          resolve();
        });
      });

      client.on("error", (err) => {
        this.emit("error", options.sessionId, err.message);
        reject(err);
      });

      client.connect(config);
    });
  }

  write(sessionId: string, data: string) {
    const session = this.sessions.get(sessionId);
    session?.stream?.write(data);
  }

  resize(sessionId: string, cols: number, rows: number) {
    const session = this.sessions.get(sessionId);
    session?.stream?.setWindow(rows, cols, 0, 0);
  }

  disconnect(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.stream?.end();
    session.client.end();
    this.sessions.delete(sessionId);
  }

  isConnected(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  execOnActiveSession(sessionId: string, command: string): Promise<string> {
    return new Promise((resolve) => {
      const session = this.sessions.get(sessionId);
      if (!session || !session.stream) {
        resolve("");
        return;
      }

      let output = "";
      const onData = (sid: string, data: string) => {
        if (sid === sessionId) {
          output += data;
        }
      };

      this.on("data", onData);

      // Disable pagination cleanly on active terminal
      session.stream.write("no page\n");

      // Write command directly to live user terminal screen
      setTimeout(() => {
        output = "";
        session.stream?.write(command + "\n");
      }, 400);

      // Collect live output
      setTimeout(() => {
        this.off("data", onData);
        resolve(output);
      }, 3500);
    });
  }

  execShellCommand(options: SshSessionOptions, command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const client = new Client();
      let output = "";
      let finished = false;

      const finish = (result: string) => {
        if (finished) return;
        finished = true;
        try {
          client.end();
        } catch {
          // ignore
        }
        resolve(result);
      };

      const config: ConnectConfig = {
        host: options.host,
        port: options.port,
        username: options.username,
        readyTimeout: 15000,
        keepaliveInterval: 5000,
        tryKeyboard: true,
        algorithms: UNIVERSAL_SSH_ALGORITHMS,
        authHandler: (methodsLeft, _partialSuccess, cb) => {
          const methods = Array.isArray(methodsLeft) ? methodsLeft : [];
          if (options.password && methods.includes("keyboard-interactive")) {
            cb("keyboard-interactive");
          } else if (options.password && methods.includes("password")) {
            cb("password");
          } else if (options.privateKey && methods.includes("publickey")) {
            cb("publickey");
          } else if (methods.length > 0) {
            cb(methods[0] as any);
          } else {
            cb(options.password ? "password" : "keyboard-interactive");
          }
        }
      };

      if (options.privateKey) {
        config.privateKey = options.privateKey;
        if (options.passphrase) config.passphrase = options.passphrase;
      }
      if (options.password) {
        config.password = options.password;
      }

      attachKeyboardInteractiveHandler(client, options.password);

      client.on("ready", () => {
        client.shell({ term: "xterm", rows: 100, cols: 200 }, (err, stream) => {
          if (err) {
            client.end();
            return reject(err);
          }

          stream.on("data", (chunk: Buffer) => {
            output += chunk.toString("utf-8");
          });

          // Disable paging for network switches (no page works for AOS-CX / HPE)
          setTimeout(() => {
            stream.write("no page\n");
          }, 400);

          // Clear initial banner and send target command
          setTimeout(() => {
            output = "";
            stream.write(command + "\n");
          }, 1000);

          // Complete after collecting output
          setTimeout(() => {
            finish(output);
          }, 3800);
        });
      });

      client.on("error", (err) => {
        if (!finished) reject(err);
      });

      client.connect(config);
    });
  }

  execReadOnly(sessionId: string, command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const session = this.sessions.get(sessionId);
      if (!session) {
        reject(new Error("Aktif oturum bulunamadı."));
        return;
      }

      session.client.exec(command, (err, stream) => {
        if (err) {
          reject(err);
          return;
        }

        let output = "";
        stream.on("data", (chunk: Buffer) => {
          output += chunk.toString("utf-8");
        });
        stream.stderr.on("data", (chunk: Buffer) => {
          output += chunk.toString("utf-8");
        });
        stream.on("close", () => resolve(output));
      });
    });
  }

  execVisibleWithResult(
    sessionId: string,
    command: string,
    options: { posixShell?: boolean; timeoutMs?: number; idleMs?: number } = {}
  ): Promise<{ output: string; exitCode: number | null }> {
    return new Promise((resolve, reject) => {
      const session = this.sessions.get(sessionId);
      if (!session || !session.stream) {
        reject(new Error("Aktif oturum bulunamadı."));
        return;
      }

      const posixShell = options.posixShell !== false;
      const marker = `__AI_SSH_DONE_${randomUUID().replace(/-/g, "")}__`;
      const timeoutMs = options.timeoutMs ?? (posixShell ? 10 * 60_000 : 60_000);
      const idleMs = options.idleMs ?? 2_500;
      let output = "";
      let settled = false;
      let idleTimer: NodeJS.Timeout | undefined;

      const cleanup = () => {
        this.off("data", onData);
        clearTimeout(timeoutTimer);
        if (idleTimer) clearTimeout(idleTimer);
      };
      const finish = (result: { output: string; exitCode: number | null }) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(result);
      };
      const scheduleIdleFinish = () => {
        if (posixShell) return;
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => finish({ output: output.trim(), exitCode: null }), idleMs);
      };
      const onData = (sid: string, data: string) => {
        if (sid !== sessionId || settled) return;
        output += data;
        if (posixShell) {
          const parsed = parseVisibleExecutionOutput(output, marker);
          if (parsed.complete) finish({ output: parsed.output, exitCode: parsed.exitCode });
        } else {
          scheduleIdleFinish();
        }
      };
      const timeoutTimer = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error(`Komut ${Math.round(timeoutMs / 1000)} saniye içinde tamamlanmadı. Terminalde çalışmaya devam ediyor olabilir.`));
      }, timeoutMs);

      this.on("data", onData);
      const wireCommand = posixShell ? buildVisibleExecutionCommand(command, marker) : command;
      session.stream.write(`${wireCommand}\n`);
      scheduleIdleFinish();
    });
  }

}

export const sshManager = new SshManager();
