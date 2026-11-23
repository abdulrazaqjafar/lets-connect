import "dotenv/config";
import { expireDueVouchers } from "../src/lib/radius/service";

const intervalMs = Number(process.env.RADIUS_SUPERVISOR_INTERVAL_MS ?? 30_000);

async function tick() {
  const started = Date.now();
  try {
    const result = await expireDueVouchers(200);
    console.log(
      JSON.stringify({
        at: new Date().toISOString(),
        durationMs: Date.now() - started,
        ...result,
      }),
    );
  } catch (error) {
    console.error("[radius-session-worker] tick failed", error);
  }
}

console.log(
  `[radius-session-worker] starting (interval=${intervalMs}ms). Ctrl+C to stop.`,
);

void tick();
const timer = setInterval(() => {
  void tick();
}, intervalMs);

function shutdown() {
  clearInterval(timer);
  console.log("[radius-session-worker] stopped");
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
