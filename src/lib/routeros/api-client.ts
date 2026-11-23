import net from "net";

export type RouterOsConnectionConfig = {
  host: string;
  port?: number;
  username: string;
  password: string;
  timeoutMs?: number;
};

/**
 * Minimal RouterOS binary API client (login + sentences).
 * Used for real-time Hotspot active-session disconnect.
 */
export class RouterOsApiClient {
  private socket: net.Socket | null = null;
  private buffer: Buffer = Buffer.alloc(0);
  private readonly cfg: Required<RouterOsConnectionConfig>;

  constructor(config: RouterOsConnectionConfig) {
    this.cfg = {
      host: config.host,
      port: config.port ?? 8728,
      username: config.username,
      password: config.password,
      timeoutMs: config.timeoutMs ?? 8000,
    };
  }

  async connect(): Promise<void> {
    if (this.socket) return;

    await new Promise<void>((resolve, reject) => {
      const socket = net.createConnection(
        { host: this.cfg.host, port: this.cfg.port },
        () => resolve(),
      );
      socket.setTimeout(this.cfg.timeoutMs);
      socket.once("error", reject);
      socket.once("timeout", () => {
        socket.destroy();
        reject(new Error("RouterOS API connection timed out"));
      });
      this.socket = socket;
      socket.on("data", (chunk: Buffer) => {
        this.buffer = Buffer.concat([this.buffer, chunk]) as Buffer;
      });
    });

    // RouterOS v6.43+ /login with post-login credentials
    const login = await this.writeSentence([
      "/login",
      `=name=${this.cfg.username}`,
      `=password=${this.cfg.password}`,
    ]);
    if (login.some((word) => word.startsWith("!trap") || word.startsWith("!fatal"))) {
      throw new Error(`RouterOS login failed: ${login.join(" ")}`);
    }
  }

  async close(): Promise<void> {
    if (!this.socket) return;
    await this.writeSentence(["/quit"]).catch(() => undefined);
    this.socket.destroy();
    this.socket = null;
    this.buffer = Buffer.alloc(0);
  }

  async run(words: string[]): Promise<string[][]> {
    await this.connect();
    const raw = await this.writeSentence(words);
    return splitReplies(raw);
  }

  /**
   * Disconnect a Hotspot user by username and/or MAC.
   * Equivalent to: /ip/hotspot/active/remove [find user=X]
   */
  async disconnectHotspotUser(opts: {
    username?: string;
    mac?: string;
  }): Promise<number> {
    const query: string[] = ["/ip/hotspot/active/print", "=.proplist=.id,user,mac-address"];
    const rows = await this.run(query);
    const ids: string[] = [];

    for (const reply of rows) {
      if (!reply[0]?.startsWith("!re")) continue;
      const map = attrsToMap(reply);
      const user = map.user ?? "";
      const mac = (map["mac-address"] ?? "").toUpperCase();
      const matchUser = opts.username && user === opts.username;
      const matchMac =
        opts.mac && mac && mac === opts.mac.replace(/-/g, ":").toUpperCase();
      if ((matchUser || matchMac) && map[".id"]) {
        ids.push(map[".id"]);
      }
    }

    for (const id of ids) {
      await this.run(["/ip/hotspot/active/remove", `=.id=${id}`]);
    }
    return ids.length;
  }

  private writeSentence(words: string[]): Promise<string[]> {
    const socket = this.socket;
    if (!socket) return Promise.reject(new Error("Not connected"));

    const payload = encodeSentence(words);
    socket.write(payload);

    return new Promise((resolve, reject) => {
      const deadline = setTimeout(() => {
        cleanup();
        reject(new Error("RouterOS API read timed out"));
      }, this.cfg.timeoutMs);

      const onData = () => {
        try {
          const decoded = tryDecodeSentences(this.buffer);
          if (!decoded) return;
          this.buffer = Buffer.from(decoded.rest);
          if (decoded.words.some((w) => w === "!done" || w.startsWith("!trap") || w.startsWith("!fatal"))) {
            cleanup();
            resolve(decoded.words);
          }
        } catch (error) {
          cleanup();
          reject(error);
        }
      };

      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };

      const cleanup = () => {
        clearTimeout(deadline);
        socket.off("data", onData);
        socket.off("error", onError);
      };

      socket.on("data", onData);
      socket.once("error", onError);
      // Process bytes already buffered
      onData();
    });
  }
}

function encodeLength(len: number): Buffer {
  if (len < 0x80) return Buffer.from([len]);
  if (len < 0x4000) {
    const buf = Buffer.alloc(2);
    buf.writeUInt16BE(len | 0x8000, 0);
    return buf;
  }
  if (len < 0x200000) {
    const buf = Buffer.alloc(3);
    buf[0] = (len >> 16) | 0xc0;
    buf[1] = (len >> 8) & 0xff;
    buf[2] = len & 0xff;
    return buf;
  }
  if (len < 0x10000000) {
    const buf = Buffer.alloc(4);
    buf.writeUInt32BE(len | 0xe0000000, 0);
    return buf;
  }
  const buf = Buffer.alloc(5);
  buf[0] = 0xf0;
  buf.writeUInt32BE(len, 1);
  return buf;
}

function encodeWord(word: string): Buffer {
  const data = Buffer.from(word, "utf8");
  return Buffer.concat([encodeLength(data.length), data]);
}

function encodeSentence(words: string[]): Buffer {
  return Buffer.concat([...words.map(encodeWord), encodeLength(0)]);
}

function readLength(buf: Buffer, offset: number): { len: number; size: number } | null {
  if (offset >= buf.length) return null;
  const first = buf[offset]!;
  if (first < 0x80) return { len: first, size: 1 };
  if (first < 0xc0) {
    if (offset + 2 > buf.length) return null;
    return { len: ((first & 0x7f) << 8) + buf[offset + 1]!, size: 2 };
  }
  if (first < 0xe0) {
    if (offset + 3 > buf.length) return null;
    return {
      len: ((first & 0x1f) << 16) + (buf[offset + 1]! << 8) + buf[offset + 2]!,
      size: 3,
    };
  }
  if (first < 0xf0) {
    if (offset + 4 > buf.length) return null;
    return {
      len:
        ((first & 0x0f) << 24) +
        (buf[offset + 1]! << 16) +
        (buf[offset + 2]! << 8) +
        buf[offset + 3]!,
      size: 4,
    };
  }
  if (offset + 5 > buf.length) return null;
  return { len: buf.readUInt32BE(offset + 1), size: 5 };
}

function tryDecodeSentences(
  buf: Buffer,
): { words: string[]; rest: Buffer } | null {
  const words: string[] = [];
  let offset = 0;

  while (offset < buf.length) {
    const lenInfo = readLength(buf, offset);
    if (!lenInfo) return null;
    offset += lenInfo.size;
    if (lenInfo.len === 0) {
      return { words, rest: buf.subarray(offset) };
    }
    if (offset + lenInfo.len > buf.length) return null;
    words.push(buf.subarray(offset, offset + lenInfo.len).toString("utf8"));
    offset += lenInfo.len;
  }
  return null;
}

function splitReplies(words: string[]): string[][] {
  const replies: string[][] = [];
  let current: string[] = [];
  for (const word of words) {
    if (word.startsWith("!") && current.length) {
      replies.push(current);
      current = [word];
    } else {
      current.push(word);
    }
  }
  if (current.length) replies.push(current);
  return replies;
}

function attrsToMap(words: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const word of words) {
    if (!word.startsWith("=")) continue;
    const eq = word.indexOf("=", 1);
    if (eq === -1) continue;
    map[word.slice(1, eq)] = word.slice(eq + 1);
  }
  return map;
}

export async function withRouterOsApi<T>(
  config: RouterOsConnectionConfig,
  fn: (client: RouterOsApiClient) => Promise<T>,
): Promise<T> {
  const client = new RouterOsApiClient(config);
  try {
    await client.connect();
    return await fn(client);
  } finally {
    await client.close().catch(() => undefined);
  }
}
