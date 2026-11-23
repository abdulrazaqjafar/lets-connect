import "dotenv/config";
import { expireDueVouchers } from "../src/lib/radius/service";
import { processRadiusSyncQueue } from "../src/lib/radius-sync-queue";

async function main() {
  const expired = await expireDueVouchers(200);
  const sync = await processRadiusSyncQueue(40);
  console.log(JSON.stringify({ expired, sync }, null, 2));
  if (expired.errors.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
