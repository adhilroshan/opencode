#!/usr/bin/env bun
// Fork publisher: ships the opencode fork as `@autofab/swarmcode` on npm
// with a drop-in `opencode` binary. Mirrors
// packages/opencode/script/publish.ts but renames every published package
// so nothing collides with upstream.
//
// Usage:
//   bun script/publish-swarmcode.ts pack      # after a build: rename dist
//                                             # packages, `bun pm pack` each,
//                                             # stage tarballs in ./dist-tgz
//   bun script/publish-swarmcode.ts publish   # npm publish staged binaries,
//                                             # then assemble + publish meta
//
// Env:
//   FORK_VERSION  version to publish (default 1.18.29-swarm.0)
//   NPM_TAG       dist-tag (default latest)

import { $ } from "bun"
import path from "path"
import { fileURLToPath } from "url"

const dir = fileURLToPath(new URL("..", import.meta.url))
process.chdir(dir)

const FORK = "@autofab/swarmcode"
const BIN = "opencode"
const VERSION = process.env["FORK_VERSION"] ?? "1.18.29-swarm.0"
const TAG = process.env["NPM_TAG"] ?? "latest"
const DIST = path.join(dir, "packages/opencode/dist")
const STAGE = path.join(dir, "dist-tgz")

const mode = process.argv[2]
if (mode !== "pack" && mode !== "publish") {
  console.error("usage: bun script/publish-swarmcode.ts <pack|publish>")
  process.exit(1)
}

async function published(name: string, version: string) {
  return (await $`npm view ${name}@${version} version --prefer-online`.nothrow()).exitCode === 0
}

async function publishTgz(tgz: string, name: string, cwd?: string) {
  try {
    if (cwd) await $`npm publish ${tgz} --access public --tag ${TAG}`.cwd(cwd)
    else await $`npm publish ${tgz} --access public --tag ${TAG}`
    console.log(`published ${name}@${VERSION}`)
  } catch (e) {
    const err = e as { stderr?: unknown }
    const text = [err.stderr, e].map(String).join("\n")
    if (text.includes("previously published versions")) {
      console.log(`already published ${name}@${VERSION}`)
      return
    }
    throw e
  }
}

function forkName(upstream: string) {
  if (!upstream.startsWith("opencode-")) throw new Error(`unexpected dist package: ${upstream}`)
  return FORK + upstream.slice("opencode".length)
}

// staged tarball filename (scope slash is not a valid filename char)
function stageFile(renamed: string) {
  return `${renamed.replace("/", "-")}-${VERSION}.tgz`
}

function stagedName(file: string) {
  const base = path.basename(file, ".tgz")
  const at = base.lastIndexOf(`-${VERSION}`)
  if (at <= 0) throw new Error(`cannot parse staged tarball: ${file}`)
  const safe = base.slice(0, at)
  return safe.startsWith("autofab-") ? `@autofab/${safe.slice("autofab-".length)}` : safe
}

if (mode === "pack") {
  await $`mkdir -p ${STAGE}`
  const dirs: string[] = []
  for (const entry of new Bun.Glob("*/package.json").scanSync({ cwd: DIST })) {
    const name = path.dirname(entry)
    if (name === FORK) continue
    dirs.push(name)
  }
  if (dirs.length === 0) throw new Error(`no dist packages found in ${DIST}`)
  for (const name of dirs.sort()) {
    const pkgPath = path.join(DIST, name, "package.json")
    const pkg = await Bun.file(pkgPath).json()
    const renamed = forkName(pkg.name)
    pkg.name = renamed
    pkg.version = VERSION
    await Bun.file(pkgPath).write(JSON.stringify(pkg, null, 2))
    console.log(`renamed ${name} -> ${renamed}@${VERSION}`)
    if (process.platform !== "win32") await $`chmod -R 755 .`.cwd(path.join(DIST, name))
    await $`bun pm pack`.cwd(path.join(DIST, name))
    const tgz = (await Array.fromAsync(new Bun.Glob("*.tgz").scan({ cwd: path.join(DIST, name) }))).sort().at(-1)
    if (!tgz) throw new Error(`no tarball produced for ${renamed}`)
    await $`mv ${path.join(DIST, name, tgz)} ${path.join(STAGE, stageFile(renamed))}`
    // drop leftover tarballs from the pack (keeps dist lean for the next batch)
    for (const extra of await Array.fromAsync(new Bun.Glob("*.tgz").scan({ cwd: path.join(DIST, name) }))) {
      await Bun.file(path.join(DIST, name, extra)).exists().then(() => $`rm ${path.join(DIST, name, extra)}`.nothrow())
    }
  }
  console.log(`staged tarballs in ${STAGE}`)
}

if (mode === "publish") {
  const tgzs = (await Array.fromAsync(new Bun.Glob("*.tgz").scan({ cwd: STAGE }))).sort()
  if (tgzs.length === 0) throw new Error(`no tarballs staged in ${STAGE}`)
  const binaries: Record<string, string> = {}
  for (const tgz of tgzs) {
    const name = stagedName(tgz)
    if (name === FORK) continue
    binaries[name] = VERSION
    if (await published(name, VERSION)) {
      console.log(`already published ${name}@${VERSION}`)
      continue
    }
    await publishTgz(path.join(STAGE, tgz), name)
  }

  // --- meta package ---
  const metaDir = path.join(STAGE, FORK)
  await $`mkdir -p ${path.join(metaDir, "bin")}`
  const upstreamPostinstall = await Bun.file(
    path.join(dir, "packages/opencode/script/postinstall.mjs"),
  ).text()
  const postinstall = upstreamPostinstall
    .replace("const base = `opencode-", "const base = `@autofab/swarmcode-")
    .replace("opencode-install-", "swarmcode-install-")
  await Bun.file(path.join(metaDir, "postinstall.mjs")).write(postinstall)
  await Bun.file(path.join(metaDir, "LICENSE")).write(await Bun.file(path.join(dir, "LICENSE")).text())
  await Bun.file(path.join(metaDir, "bin", `${BIN}.exe`)).write(
    [
      `echo "Error: ${FORK}'s postinstall script was not run." >&2`,
      'echo "" >&2',
      'echo "This occurs when using --ignore-scripts during installation, or when using a" >&2',
      'echo "package manager like pnpm that does not run postinstall scripts by default." >&2',
      'echo "" >&2',
      'echo "To fix this, run the postinstall script manually:" >&2',
      `echo "  cd node_modules/${FORK} && node postinstall.mjs" >&2`,
      'echo "" >&2',
      `echo "Or reinstall ${FORK} without the --ignore-scripts flag." >&2`,
      "exit 1",
      "",
    ].join("\n"),
  )
  await Bun.file(path.join(metaDir, "package.json")).write(
    JSON.stringify(
      {
        name: FORK,
        version: VERSION,
        description: "opencode fork with agent teams, background subagents and dynamic workflows",
        license: "MIT",
        bin: {
          [BIN]: `./bin/${BIN}.exe`,
        },
        scripts: {
          postinstall: "node ./postinstall.mjs",
        },
        os: ["darwin", "linux", "win32"],
        cpu: ["arm64", "x64"],
        optionalDependencies: binaries,
      },
      null,
      2,
    ),
  )
  if (await published(FORK, VERSION)) {
    console.log(`already published ${FORK}@${VERSION}`)
  } else {
    await $`bun pm pack`.cwd(metaDir)
    const metaTgz = (await Array.fromAsync(new Bun.Glob("*.tgz").scan({ cwd: metaDir }))).sort().at(-1)
    if (!metaTgz) throw new Error("meta tarball missing")
    await publishTgz(path.join(metaDir, metaTgz), FORK, metaDir)
  }
}
