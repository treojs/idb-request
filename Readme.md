# idb-request

> Transform IndexedDB request-like object to a `Promise`.

[![](https://img.shields.io/npm/v/idb-request.svg)](https://npmjs.org/package/idb-request)
[![](https://img.shields.io/travis/treojs/idb-request.svg)](https://travis-ci.org/treojs/idb-request)
[![](http://img.shields.io/npm/dm/idb-request.svg)](https://npmjs.org/package/idb-request)

[![](https://saucelabs.com/browser-matrix/idb-request.svg)](https://saucelabs.com/u/idb-request)

[ES2015 `Promise`](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise) is a nice way to deal with primitives of IndexedDB. `IDBRequest` has `onsuccess` and `onerror` callbacks, which perfectly map to Promise's `resolve` and `reject`. The same applies to `IDBTransaction`'s `oncomplete` and `onerror`.

**But** if you're going to reuse transactions, you can't do it with `Promise` sugar and need to rely on `onsuccess` callback. This problem is well explained in ["Tasks, microtasks, queues and schedules"](https://jakearchibald.com/2015/tasks-microtasks-queues-and-schedules/) article.

## Installation

    npm install --save idb-request

## Example

Using [ES2016 async/await syntax](http://tc39.github.io/ecmascript-asyncawait/).

```js
import { open } from 'idb-factory'
import { request, requestTransaction, requestCursor } from 'idb-request'

async () => {  
  const db = async open('mydb', 1, upgradeCallback)
  const tr = db.transaction(['books'], 'readwrite')
  async Promise.all([
    request(books.put({ id: 1, title: 'Book 1', author: 'Author 1' })),
    request(books.put({ id: 2, title: 'Book 2', author: 'Author 1' })),
    request(books.put({ id: 3, title: 'Book 3', author: 'Author 3' })),
  ])
  async requestTransaction(tr)

  const req = books.index('byAuthor').openCursor(null, 'nextunique')
  const authors = []
  async requestCursor(req, (cursor) => {
    authors.push(cursor.value)
    cursor.continue()
  })

  console.assert(authors === ['Author 1', 'Author 2'])
}()

function upgradeCallback(e) {
  const books = e.target.result.createObjectStore('books', { keyPath: 'id' })
  books.createIndex('byTitle', 'title', { unique: true })
  books.createIndex('byAuthor', 'author')
}
```

## API

Each function returns `Promise`.
If it's not available you can polyfill it using [es6-promise](https://github.com/jakearchibald/es6-promise) for example.

### request(req, [tr])

Listen to request's `onsuccess` event.

```js
import { request } from 'idb-request'

const books = db.transaction(['books'], 'readonly').objectStore('books')
request(books.count()).then((count) => {})
```

Pass transaction as a second argument to wait for completion and return request's result.

```js
import { request } from 'idb-request'

const tr = db.transaction(['books'], 'readwrite')
const books = tr.objectStore('books')
const req = books.put({ title: 'Store 1' })

request(req, tr).then((requestResult) => {

})
```

### requestCursor(req, iterator)

Iterate through object store or index using cursor.

```js
import { requestCursor } from 'idb-request'

const result = []
const req = books.openCursor()

requestCursor(req, (cursor) => {
  result.push(cursor.value)
  cursor.continue()
}).then(function() {
  return result
})
```

### requestTransaction(tr)

Listen to transaction's `oncomplete` event.

```js
import { request, requestTransaction } from 'idb-request'

const tr = db.transaction(['books'], 'readwrite')
const books = tr.objectStore('books')

Promise.all([
  request(books.put({ id: 1, title: 'Book 1' })),
  request(books.put({ id: 2, title: 'Book 2' })),
  request(books.put({ id: 3, title: 'Book 3' })),
]).then(() => {
  return requestTransaction(tr)
})
```

## License

[MIT](./LICENSE)
