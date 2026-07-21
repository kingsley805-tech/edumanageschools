/**
 * Standardized IPC response envelope.
 */
function ok(data = null) {
  return { ok: true, data, error: null };
}

function fail(error, code = "ERROR") {
  const message = error instanceof Error ? error.message : String(error || "Unknown error");
  return { ok: false, data: null, error: { code, message } };
}

function wrap(handler) {
  return async (...args) => {
    try {
      const data = await handler(...args);
      return ok(data);
    } catch (err) {
      return fail(err);
    }
  };
}

module.exports = { ok, fail, wrap };
