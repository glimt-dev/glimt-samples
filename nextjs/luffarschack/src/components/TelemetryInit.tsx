"use client";

import { useEffect, useRef } from "react";
import {
  registerOTelBrowser,
  type BrowserSDK,
} from "@aient/otel-browser";
import { BROWSER_TELEMETRY } from "@/lib/env";

export default function TelemetryInit() {
  const sdkRef = useRef<BrowserSDK | null>(null);

  useEffect(() => {
    const sdk = registerOTelBrowser({
      ...BROWSER_TELEMETRY,
      captureConsoleLogs: true,
    });
    sdkRef.current = sdk;

    return () => {
      if (sdkRef.current === sdk) {
        sdkRef.current = null;
      }
      void sdk.shutdown();
    };
  }, []);

  return null;
}