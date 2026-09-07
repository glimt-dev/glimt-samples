import { spawnSync } from "node:child_process";

const isVercelPreview =
  process.env.VERCEL === "1" && process.env.VERCEL_ENV === "preview";
const commit = process.env.COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA;
const branch = process.env.COMMIT_REF || process.env.VERCEL_GIT_COMMIT_REF;
const environment =
  process.env.AIENT_ENV ||
  (process.env.VERCEL_ENV === "production"
    ? "prod"
    : process.env.VERCEL_ENV) ||
  "prod";

if (!commit) {
  throw new Error(
    "COMMIT_SHA or VERCEL_GIT_COMMIT_SHA is required for release metadata and source-map uploads.",
  );
}

if (
  process.env.NEXT_PUBLIC_COMMIT_SHA &&
  process.env.NEXT_PUBLIC_COMMIT_SHA !== commit
) {
  throw new Error(
    "NEXT_PUBLIC_COMMIT_SHA must match COMMIT_SHA or VERCEL_GIT_COMMIT_SHA.",
  );
}

const buildEnv = {
  ...process.env,
  COMMIT_SHA: commit,
  COMMIT_REF: branch,
  NEXT_PUBLIC_COMMIT_SHA: commit,
  NEXT_PUBLIC_COMMIT_REF: process.env.NEXT_PUBLIC_COMMIT_REF || branch,
  AIENT_ENV: environment,
  NEXT_PUBLIC_AIENT_ENV:
    process.env.NEXT_PUBLIC_AIENT_ENV || environment,
};

run("next", ["build"], buildEnv);

if (!buildEnv.AIENT_API_KEY) {
  if (isVercelPreview) {
    console.warn(
      "Skipping Aient source-map upload because AIENT_API_KEY is not configured for this Vercel preview. Production deployments still require it.",
    );
  } else {
    throw new Error(
      "AIENT_API_KEY is required to upload source maps from the production build.",
    );
  }
} else {
  const browserService =
    buildEnv.NEXT_PUBLIC_OTEL_SERVICE_NAME ?? "luffarschack";
  const serverService = buildEnv.OTEL_SERVICE_NAME ?? "luffarschack";

  upload(".next/static", browserService, "/_next/static");
  upload(
    ".next/server",
    serverService,
    buildEnv.AIENT_SERVER_BUNDLE_PREFIX ?? "/.next/server",
  );
}

function upload(directory, service, bundlePrefix) {
  run(
    "aient-sourcemaps",
    [
      "upload",
      directory,
      "--service",
      service,
      "--commit",
      commit,
      "--bundle-prefix",
      bundlePrefix,
      "--fail-on-empty",
    ],
    buildEnv,
  );
}

function run(command, args, env) {
  const executable =
    process.platform === "win32" ? `${command}.cmd` : command;
  const result = spawnSync(executable, args, { env, stdio: "inherit" });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}