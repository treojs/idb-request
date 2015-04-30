
/**
 * Expose `request()`.
 */

exports = module.exports = request;

/**
 * Expose link to `Promise`,
 * to enable replacement with different implementations.
 */

exports.Promise = global.Promise;

/**
 * Transform IndexedDB request-like object to `Promise`.
 *
 * - request(req)
 * - request(tr) - wait for transaction complete
 * - request(req, tr) - handle request + wait for transaction complete
 * - request(req, iterator) - call iterator function
 *
 * @param {IDBRequest|IDBTransaction} req
 * @param {Function|IDBTransaction} [iterator]
 * @return {Promise}
 */

function request(req, iterator) {
  return new exports.Promise(function(resolve, reject) {
    req.onerror = function onerror(e) {
      // prevent global error throw
      // https://bugzilla.mozilla.org/show_bug.cgi?id=872873
      if (e.preventDefault) e.preventDefault();
      reject(e.target.error);
    };

    // open/deleteDatabase requests, can be locked, and it's an error
    if (req.onblocked === null) {
      req.onblocked = function onblocked(e) {
        e.preventDefault();
        reject(e.target.error);
      };
    }

    if (req.onsuccess === null) { // request
      if (iterator && iterator.oncomplete === null) { // second argument is transaction
        var result;
        req.onsuccess = function onsuccess(e) { result = e.target.result };
        iterator.oncomplete = function oncomplete() { resolve(result) };
      } else {
        req.onsuccess = function onsuccess(e) {
          var res = e.target.result;
          if (res && typeof iterator == 'function') { // check cursor
            iterator(res);
          } else {
            resolve(res); // resolve
          }
        };
      }
    } else { // transaction
      req.oncomplete = function oncomplete() { resolve() };
    }
  });
}
