function parseBooleanEnv(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
}

function isRuntimeSchemaEnsureEnabled(flagName, fallback = false) {
  if (parseBooleanEnv(process.env.RUNTIME_SCHEMA_ENSURE_ALL, false)) {
    return true;
  }

  return parseBooleanEnv(process.env[flagName], fallback);
}

module.exports = {
  isRuntimeSchemaEnsureEnabled,
  parseBooleanEnv,
};
