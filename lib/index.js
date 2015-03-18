
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
 * Transform IndexedDB request-like objects to `Promise`.
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
    // always listen to an error
    req.onerror = function onerror(e) { reject(e.target.error) };

    if (req.onsuccess === null) { // request
      if (iterator && iterator.oncomplete === null) { // second argument is transaction
        var result;
        req.onsuccess = function onsuccess(e) { result = e.target.result };
        iterator.oncomplete = function oncomplete() { resolve(result) };
      } else {
        req.onsuccess = function onsuccess(e) {
          var res = e.target.result;
          res && iterator ? iterator(res) : resolve(res); // check if needs to iterate over cursor
        };
      }
    } else { // transaction
      req.oncomplete = function oncomplete() { resolve() };
    }
  });
}
