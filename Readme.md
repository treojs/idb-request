# idb-request

> Transform IndexedDB request-like object to a `Promise`.

[![](https://img.shields.io/npm/v/idb-request.svg)](https://npmjs.org/package/idb-request)
[![](https://img.shields.io/travis/treojs/idb-request.svg)](https://travis-ci.org/treojs/idb-request)
[![](http://img.shields.io/npm/dm/idb-request.svg)](https://npmjs.org/package/idb-request)

[![](https://saucelabs.com/browser-matrix/idb-request.svg)](https://saucelabs.com/u/idb-request)

[Promise](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise) is a nice way to deal with primitives of IndexedDB. `IDBRequest` has `onsuccess` and `onerror` callbacks, which perfectly map to Promise's `resolve` and `reject`. The same applies to `oncomplete` and `onerror` of `IDBTransaction`.

**Note:** if you're going to reuse transactions, you can't do it with `Promise` and need to rely on default callback syntax. This issue is well explained in ["Tasks, microtasks, queues and schedules" article](https://jakearchibald.com/2015/tasks-microtasks-queues-and-schedules/).

## Installation

    npm install --save idb-request

## Example

Using [ES2016 async/await syntax](http://tc39.github.io/ecmascript-asyncawait/).

```js
import { open } from 'idb-factory'
import { request, requestTransaction, requestCursor } from 'idb-request'
import map from 'lodash.map'

async () => {  
  const db = await open('mydb', 1, upgradeCallback)
  const tr = db.transaction(['books'], 'readwrite')

  await Promise.all([
    request(books.put({ id: 1, title: 'Quarry Memories', author: 'Fred' })),
    request(books.put({ id: 2, title: 'Water Buffaloes', author: 'Fred' })),
    request(books.put({ id: 3, title: 'Bedrock Nights', author: 'Barney' })),
    requestTransaction(tr),
  ])

  const req = books.index('byAuthor').openCursor(null, 'nextunique')
  const authors = []
  await requestCursor(req, (cursor) => {
    authors.push(cursor.value)
    cursor.continue()
  })

  console.assert(map(authors, 'author') === ['Barney', 'Fred'])
}()

function upgradeCallback(e) {
  const books = e.target.result.createObjectStore('books', { keyPath: 'id' })
  books.createIndex('byTitle', 'title', { unique: true })
  books.createIndex('byAuthor', 'author')
}
```

## API

Each function returns `Promise`.

### request(req, [tr])

Listen to request's `onsuccess` event.

```js
import { request } from 'idb-request'

const books = db.transaction(['books'], 'readonly').objectStore('books')
request(books.count()).then((count) => {})
```

Pass transaction as a second argument to wait for completion and return result of request.

```js
import { request } from 'idb-request'

const tr = db.transaction(['books'], 'readwrite')
const books = tr.objectStore('books')
const req = books.put({ title: 'Store 1' })

request(req, tr).then((requestResult) => {})
```

### mapCursor(req, iterator)

Map values over cursor.
Iterator has 2 arguments:
- `cursor` object,
- `result` array, which is returned on resolve. Default value is `[]`.

```js
import { mapCursor } from 'idb-request'

const result = await mapCursor(books.openCursor(), (cursor, memo) => {
  memo.push(cursor.value)
  cursor.continue()
})
```

### requestCursor(req, iterator)

Iterate through object store or index using cursor.
The same example as `mapCursor` above:

```js
import { requestCursor } from 'idb-request'

const result = []
const req = books.openCursor()

await requestCursor(req, (cursor) => {
  result.push(cursor.value)
  cursor.continue()
})

// use result
```

### requestTransaction(tr)

Listen to transaction's `oncomplete` event.

```js
import { request, requestTransaction } from 'idb-request'

const tr = db.transaction(['books'], 'readwrite')
const books = tr.objectStore('books')

await Promise.all([
  request(books.put({ id: 1, title: 'Quarry Memories' })),
  request(books.put({ id: 2, title: 'Water Buffaloes' })),
  request(books.put({ id: 3, title: 'Bedrock Nights' })),
  requestTransaction(tr),
])
```

## License

[MIT](./LICENSE)
