const VERSION_REGEX = /("version"\s*:\s*")(\d+\.\d+\.\d+)(")/;

module.exports.readVersion = function readVersion(contents) {
  const match = String(contents || "").match(VERSION_REGEX);
  if (!match) {
    throw new Error("Version introuvable dans releases.js");
  }
  return match[2];
};

module.exports.writeVersion = function writeVersion(contents, version) {
  if (!version) return contents;
  return String(contents || "").replace(VERSION_REGEX, `$1${version}$3`);
};
