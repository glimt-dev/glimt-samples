import { registerOTel } from "@aient/otel";
import { SERVER_TELEMETRY } from "@/lib/env";

export function register() {
  registerOTel(SERVER_TELEMETRY);
}