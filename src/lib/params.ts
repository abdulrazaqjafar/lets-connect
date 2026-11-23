import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";

type RouteIdOk = { ok: true; id: string };
type RouteIdErr = { ok: false; response: NextResponse };

/** Narrow dynamic route params that Next may type as string | undefined. */
export function asRouteId(
  value: string | undefined,
  name: string,
): RouteIdOk | RouteIdErr {
  if (!value) {
    return { ok: false, response: jsonError(`Missing ${name}`, 400) };
  }
  return { ok: true, id: value };
}
