# idb-request

[![](https://img.shields.io/npm/v/idb-request.svg)](https://npmjs.org/package/idb-request)
[![](https://img.shields.io/travis/treojs/idb-request.svg)](https://travis-ci.org/treojs/idb-request)
[![](http://img.shields.io/npm/dm/idb-request.svg)](https://npmjs.org/package/idb-request)

Transform IndexedDB request-like object to a `Promise`.

## Example

Using [es6-promise](https://github.com/jakearchibald/es6-promise):

```js
var request = require('idb-request');
var Promise = require('es6-promise');
request.Promise = Promise; // force idb-request to use es6-promise

var req = window.indexedDB.open('mydb');
req.onupgradenedded = onupgradeneeded;

request(req).then(function(db) {
  var tr = db.transaction(['books'], 'readwrite');
  var books = tr.objectStore('books');

  Promise.all([
    request(books.put({ id: 1, title: 'Book 1', author: 'Author 1' })),
    request(books.put({ id: 2, title: 'Book 2', author: 'Author 2' })),
    request(books.put({ id: 3, title: 'Book 3', author: 'Author 3' })),
  ]).then(function() {
    return request(books.count()).then(function(count) {
      console.log(count); // 3
    });
  }).catch(function(err) {
    // handle error
  });
});

function onupgradeneeded(e) {
  var db = e.target.result;
  if (e.oldVersion < 1) {
    var books = db.createObjectStore('books', { keyPath: 'id' });
    books.createIndex('byTitle', 'title', { unique: true });
    books.createIndex('byAuthor', 'author');
  }
}
```

More advanced example using
[ES7 async/await](https://github.com/lukehoban/ecmascript-asyncawait) syntax, [idb-schema](https://github.com/treojs/idb-schema), and [idb-range](https://github.com/treojs/idb-range):

```js
var request = require('idb-request');
var Schema = require('idb-schema');
var range = require('idb-range');

async function() {
  var schema = new Schema()
  .addStore('books', { key: 'id', increment: true })
  .addIndex('byTitle', 'title', { unique: true })
  .addIndex('byAuthor', 'author');

  // open database
  var req = window.indexedDB.open('mydb', schema.version());
  req.onupgradeneeded = schema.callback();
  var db = await request(req);

  // write data
  var tr = db.transaction(['books'], 'readwrite');
  var books = tr.objectStore('books');

  // put data in one transaction
  await request(books.put({ id: 1, title: 'Book 1', author: 'Author 1' }));
  await request(books.put({ id: 2, title: 'Book 2', author: 'Author 2' }));
  await request(books.put({ id: 3, title: 'Book 3', author: 'Author 3' }));
  await request(tr); // complete transaction

  // read data
  tr = db.transaction(['books'], 'readonly');
  books = tr.objectStore('books');

  var book1 = await request(books.get(1));
  var book2 = await request(books.get(2));
  var count = await request(books.index('byAuthor').count(range({ gte: 'Author 2' })));

  assert(book1.title == 'Book 1');
  assert(book2.title == 'Book 2');
  assert(count == 2);
}();
```

## Caveats

`Promise` seems like a nice way to deal with IndexedDB's asynchrony.
**But** browsers have different implementations, and for now only Chrome performs correctly.
The problem related with [micro-tasks queue and IndexedDB transactions](https://stackoverflow.com/questions/28388129/inconsistent-interplay-between-indexeddb-transactions-and-promises).

## API

### request(req, [tr])

Listen to request's `onsuccess` event.

```js
var req = window.indexedDB.deleteDatabase('mydb');
request(req);
```

Or pass transaction as a second argument to wait for completion.

```js
var tr = db.transaction(['stores'], 'readwrite');
var stores = tr.objectStore('stores');
var req = stores.put({ title: 'Store 1' });
request(req, tr).then(function(requestResult) {});
```

### request(req, iterator)

Iterate through object store or index using cursor.

```js
var result = [];
var req = stores.openCursor();
request(req, iterator).then(function() {});

function iterator(cursor) {
  result.push(cursor.value);
  cursor.continue();
}
```

### request(tr)

Listen to transaction's `oncomplete` event.

```js
var tr = db.transaction(['stores'], 'readwrite');
var stores = tr.objectStore('stores');

Promise.all([
  request(stores.put({ id: 1, title: 'Book 1' })),
  request(stores.put({ id: 2, title: 'Book 2' })),
  request(stores.put({ id: 3, title: 'Book 3' })),
]).then(function() {
  return request(tr); // wait transaction to complete
});
```

### request.Promise

By default it uses globally available `Promise` implementation.
You can replace it with any ES6 compatible module
like [es6-promise](https://github.com/jakearchibald/es6-promise) or [bluebird](https://github.com/petkaantonov/bluebird).

```js
var request = require('idb-request');
request.Promise = require('es6-promise');
```

## License

MIT
