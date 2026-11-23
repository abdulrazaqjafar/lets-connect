import "dotenv/config";
import { expireAllStaleSubscriptions } from "../src/lib/subscriptions";

async function main() {
  const result = await expireAllStaleSubscriptions();
  console.log("[expire-subscriptions]", result);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
