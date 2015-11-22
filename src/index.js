
/**
 * Transform IDBRequest to `Promise`,
 * which resolves on `success` or on `complete` when `tr` passed.
 *
 * @param {IDBRequest|IDBOpenDBRequest} req
 * @param {IDBTransaction} [tr]
 * @return {Promise}
 */

export function request(req, tr = null) {
  let result
  return new Promise((resolve, reject) => {
    req.onerror = handleError(reject)
    req.onsuccess = (e) => {
      result = e.target.result
      if (!tr) resolve(e.target.result)
    }
    // open/deleteDatabase requests, can be locked, and it's an error
    if (req.onblocked === null) req.onblocked = handleError(reject)
    if (tr) tr.oncomplete = () => resolve(result)
  })
}

/**
 * Transform `tr` to `Promise`.
 *
 * @param {IDBTransaction} tr
 * @return {Promise}
 */

export function requestTransaction(tr) {
  return new Promise((resolve, reject) => {
    tr.onerror = handleError(reject)
    tr.oncomplete = () => resolve()
  })
}

/**
 * Call `iterator` for each `onsuccess` event.
 *
 * @param {IDBRequest} req
 * @param {Function} iterator
 * @return {Promise}
 */

export function requestCursor(req, iterator) {
  return new Promise((resolve, reject) => {
    req.onerror = handleError(reject)
    req.onsuccess = (e) => {
      const cursor = e.target.result
      if (cursor) {
        iterator(cursor)
      } else {
        resolve()
      }
    }
  })
}

/**
 * Helper to handle errors and call `reject`.
 *
 * @param {Function} reject - from Promise constructor
 * @return {Function}
 */

function handleError(reject) {
  return (e) => {
    // prevent global error throw https://bugzilla.mozilla.org/show_bug.cgi?id=872873
    if (typeof e.preventDefault === 'function') e.preventDefault()
    reject(e.target.error)
  }
}
