import "dotenv/config";
import { expireDueVouchers } from "../src/lib/radius/service";

expireDueVouchers(200)
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.errors.length ? 1 : 0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
