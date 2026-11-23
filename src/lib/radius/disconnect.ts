import { createHash, randomBytes } from "crypto";
import dgram from "dgram";

/** RFC 5176 — Disconnect-Request */
const CODE_DISCONNECT_REQUEST = 40;
/** RFC 5176 — CoA-Request (optional future use) */
export const CODE_COA_REQUEST = 43;

const ATTR_USER_NAME = 1;
const ATTR_NAS_IP_ADDRESS = 4;
const ATTR_CALLING_STATION_ID = 31;
const ATTR_ACCT_SESSION_ID = 44;

export type DisconnectRequestInput = {
  /** MikroTik / NAS IP that accepts PoD on UDP 3799 */
  nasIp: string;
  /** RADIUS shared secret configured on the NAS */
  secret: string;
  port?: number;
  username: string;
  acctSessionId?: string | null;
  callingStationId?: string | null;
  timeoutMs?: number;
};

/**
 * Send a RADIUS Disconnect-Request (Packet of Disconnect / PoD) to MikroTik.
 * MikroTik typically listens on UDP 3799 when `/radius incoming` is enabled.
 */
export async function sendDisconnectRequest(
  input: DisconnectRequestInput,
): Promise<{ ok: boolean; detail: string }> {
  const port = input.port ?? Number(process.env.RADIUS_POD_PORT ?? 3799);
  const timeoutMs = input.timeoutMs ?? 4000;

  const attrs: Buffer[] = [
    encodeAttr(ATTR_USER_NAME, Buffer.from(input.username, "utf8")),
  ];

  if (input.acctSessionId) {
    attrs.push(
      encodeAttr(ATTR_ACCT_SESSION_ID, Buffer.from(input.acctSessionId, "utf8")),
    );
  }
  if (input.callingStationId) {
    attrs.push(
      encodeAttr(
        ATTR_CALLING_STATION_ID,
        Buffer.from(input.callingStationId, "utf8"),
      ),
    );
  }

  // Include NAS-IP-Address when it looks like IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(input.nasIp)) {
    attrs.push(encodeAttr(ATTR_NAS_IP_ADDRESS, ipv4ToBuffer(input.nasIp)));
  }

  const attributes = Buffer.concat(attrs);
  const identifier = randomBytes(1)[0]!;
  const length = 20 + attributes.length;

  // Request Authenticator = MD5(Code+ID+Len+16 zero bytes+Attributes+Secret)
  const headerWithoutAuth = Buffer.alloc(4);
  headerWithoutAuth[0] = CODE_DISCONNECT_REQUEST;
  headerWithoutAuth[1] = identifier;
  headerWithoutAuth.writeUInt16BE(length, 2);

  const zeroAuth = Buffer.alloc(16, 0);
  const authenticator = createHash("md5")
    .update(headerWithoutAuth)
    .update(zeroAuth)
    .update(attributes)
    .update(Buffer.from(input.secret, "utf8"))
    .digest();

  const packet = Buffer.concat([
    headerWithoutAuth,
    authenticator,
    attributes,
  ]);

  return new Promise((resolve) => {
    const socket = dgram.createSocket("udp4");
    let settled = false;

    const finish = (ok: boolean, detail: string) => {
      if (settled) return;
      settled = true;
      try {
        socket.close();
      } catch {
        /* ignore */
      }
      resolve({ ok, detail });
    };

    const timer = setTimeout(() => {
      // Many MikroTiks process PoD without ACK in all configs — treat timeout as sent
      finish(true, `Disconnect-Request sent to ${input.nasIp}:${port} (no ACK)`);
    }, timeoutMs);

    socket.on("error", (error) => {
      clearTimeout(timer);
      finish(false, error.message);
    });

    socket.on("message", (msg) => {
      clearTimeout(timer);
      const code = msg[0];
      if (code === 41) {
        finish(true, "Disconnect-ACK");
      } else if (code === 42) {
        finish(false, "Disconnect-NAK");
      } else {
        finish(true, `RADIUS response code=${code}`);
      }
    });

    socket.send(packet, port, input.nasIp, (error) => {
      if (error) {
        clearTimeout(timer);
        finish(false, error.message);
      }
    });
  });
}

function encodeAttr(type: number, value: Buffer): Buffer {
  const len = value.length + 2;
  if (len > 255) {
    throw new Error(`RADIUS attribute ${type} too long`);
  }
  return Buffer.concat([Buffer.from([type, len]), value]);
}

function ipv4ToBuffer(ip: string): Buffer {
  const parts = ip.split(".").map((p) => Number(p));
  return Buffer.from(parts);
}
