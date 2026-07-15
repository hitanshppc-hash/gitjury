#!/usr/bin/env node
// Pushes local env values into the GitHub repo's encrypted Actions secrets store —
// so CI/CD can use them without anyone typing them into the GitHub web UI by hand.
// Values are encrypted client-side with libsodium sealed-box, using the repo's own
// public key, before they ever leave this machine — GitHub itself can't read them
// back out, only decrypt them for a running workflow. Nothing here is ever committed:
// this script only reads from .env.local (gitignored) and an ephemeral CLI token.
//
// Usage:
//   node scripts/set-github-secrets.mjs <owner>/<repo> <github_pat>
//
// The GitHub secret name GITHUB_TOKEN is reserved by Actions itself (it's auto-injected
// into every workflow run), so the app's GITHUB_TOKEN env var is stored under the repo
// secret name APP_GITHUB_TOKEN instead — see .github/workflows/ci.yml for the mapping.

import fs from "node:fs";
import path from "node:path";
import sodium from "libsodium-wrappers";

const SECRET_NAME_MAP = {
  OPENROUTER_API_KEY: "OPENROUTER_API_KEY",
  GROQ_API_KEY: "GROQ_API_KEY",
  GITHUB_TOKEN: "APP_GITHUB_TOKEN",
};

function parseEnvFile(filePath) {
  const text = fs.readFileSync(filePath, "utf-8");
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) values[m[1]] = m[2].trim();
  }
  return values;
}

async function gh(token, url, opts = {}) {
  const res = await fetch(`https://api.github.com${url}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
      ...opts.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub API ${opts.method || "GET"} ${url} -> ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.status === 204 ? null : res.json();
}

async function main() {
  const [repoArg, tokenArg] = process.argv.slice(2);
  if (!repoArg || !tokenArg) {
    console.error("Usage: node scripts/set-github-secrets.mjs <owner>/<repo> <github_pat>");
    process.exit(1);
  }

  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    console.error(`No .env.local found at ${envPath}`);
    process.exit(1);
  }
  const env = parseEnvFile(envPath);

  await sodium.ready;

  console.log(`Fetching public key for ${repoArg}...`);
  const { key, key_id } = await gh(tokenArg, `/repos/${repoArg}/actions/secrets/public-key`);
  const publicKeyBytes = sodium.from_base64(key, sodium.base64_variants.ORIGINAL);

  for (const [envKey, secretName] of Object.entries(SECRET_NAME_MAP)) {
    const value = env[envKey];
    if (!value) {
      console.log(`Skipping ${envKey} (empty in .env.local)`);
      continue;
    }
    const encryptedBytes = sodium.crypto_box_seal(sodium.from_string(value), publicKeyBytes);
    const encryptedValue = sodium.to_base64(encryptedBytes, sodium.base64_variants.ORIGINAL);

    await gh(tokenArg, `/repos/${repoArg}/actions/secrets/${secretName}`, {
      method: "PUT",
      body: JSON.stringify({ encrypted_value: encryptedValue, key_id }),
    });
    console.log(`Set secret: ${secretName} (from .env.local ${envKey})`);
  }

  console.log("Done. Secrets are encrypted at rest on GitHub and are not visible again via the API or UI.");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
