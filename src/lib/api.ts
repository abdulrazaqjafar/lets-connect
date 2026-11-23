import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, { status: 200, ...init });
}

export function jsonCreated<T>(data: T) {
  return NextResponse.json(data, { status: 201 });
}

export function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    { error: message, ...(details !== undefined ? { details } : {}) },
    { status },
  );
}

export function handleRouteError(error: unknown) {
  if (error instanceof ZodError) {
    return jsonError("Validation failed", 400, error.flatten());
  }

  console.error(error);

  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes("Can't reach database server") ||
    message.includes("P1001") ||
    (error as { name?: string })?.name === "PrismaClientInitializationError"
  ) {
    return jsonError(
      "Database is offline. Start PostgreSQL on localhost:5432, then run prisma db push.",
      503,
    );
  }

  return jsonError("Internal server error", 500);
}
