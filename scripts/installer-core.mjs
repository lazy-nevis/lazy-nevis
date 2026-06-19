export const normalizeVersion = (value) => {
  const version = value?.replace(/^v/, "");
  if (!version || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Invalid semantic version: ${value ?? ""}`);
  }
  return version;
};

export const chooseRelease = (releases, { version, prerelease = false } = {}) => {
  const published = releases.filter((release) => !release.draft);
  if (version) {
    const tag = `v${normalizeVersion(version)}`;
    const match = published.filter((release) => release.tag_name === tag);
    if (match.length !== 1) throw new Error(`Expected one release for ${tag}, found ${match.length}.`);
    if (match[0].prerelease && !prerelease) throw new Error("Prerelease requires explicit opt-in.");
    return match[0];
  }
  const candidates = published.filter((release) => prerelease || !release.prerelease);
  if (!candidates.length) throw new Error("No matching published release.");
  return candidates[0];
};

export const chooseAsset = (assets, pattern) => {
  const matches = assets.filter((asset) => pattern.test(asset.name));
  if (matches.length !== 1) throw new Error(`Expected one matching asset, found ${matches.length}.`);
  const url = new URL(matches[0].browser_download_url);
  if (url.protocol !== "https:" || url.hostname !== "github.com") throw new Error("Asset is not hosted on official GitHub HTTPS.");
  return matches[0];
};

export const checksumFor = (manifest, filename) => {
  const lines = manifest.split(/\r?\n/).filter(Boolean);
  const matches = lines.flatMap((line) => {
    const match = line.match(/^([a-fA-F0-9]{64})\s+\*?(.+)$/);
    return match && match[2] === filename ? [match[1].toLowerCase()] : [];
  });
  if (matches.length !== 1) throw new Error(`Expected one checksum for ${filename}, found ${matches.length}.`);
  return matches[0];
};
