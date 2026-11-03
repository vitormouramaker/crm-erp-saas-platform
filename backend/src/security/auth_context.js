const { AsyncLocalStorage } = require("async_hooks");

const authStorage = new AsyncLocalStorage();

module.exports = {
  runWithAuth(auth, callback) {
    return authStorage.run(auth, callback);
  },
  getAuth() {
    return authStorage.getStore() || null;
  },
};
