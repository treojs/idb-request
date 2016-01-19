
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
  // patch iterator to fix:
  // https://github.com/axemclion/IndexedDBShim/issues/204

  const keys = {} // count unique keys
  const patchedIterator = (cursor) => {
    if ((cursor.direction === 'prevunique' || cursor.direction === 'nextunique') && !cursor.source.multiEntry) {
      if (!keys[cursor.key]) {
        keys[cursor.key] = true
        iterator(cursor)
      } else {
        cursor.continue()
      }
    } else {
      iterator(cursor)
    }
  }

  return new Promise((resolve, reject) => {
    req.onerror = handleError(reject)
    req.onsuccess = (e) => {
      const cursor = e.target.result
      if (cursor) {
        patchedIterator(cursor)
      } else {
        resolve()
      }
    }
  })
}

/**
 * Special helper to map values over cursor.
 *
 * @param {IDBRequest} req
 * @param {Function} iterator
 * @return {Promise}
 */

export function mapCursor(req, iterator) {
  const result = []
  return requestCursor(req, (cursor) => iterator(cursor, result)).then(() => result)
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
