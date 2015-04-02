# idb-request

Transform IndexedDB request-like object to `Promise`.

## Example

[ES7 async/await](https://github.com/lukehoban/ecmascript-asyncawait) example,
which can be compiled with [babel](https://babeljs.io):

```js
var request = require('idb-request');
var range = require('idb-range');
var assert = console.assert.bind(console);
var idb = window.indexedDB;

async function() {
  // open database
  var req = idb.open('mydb', 1);
  req.onupgradeneeded = onupgradeneeded;
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
}

function onupgradeneeded(e) {
  var db = e.target.result;
  if (e.oldVersion < 1) {
    var books = db.createObjectStore('books', { keyPath: 'id' });
    var magazines = db.createObjectStore('magazines');
    books.createIndex('byTitle', 'title', { unique: true });
    books.createIndex('byAuthor', 'author');
    magazines.createIndex('byPublisher', 'publisher');
  }
}
```

## API
### request(req, [tr])

Create request and wait transaction to complete.

```js
var tr = db.transaction(['stores'], 'readwrite');
var stores = tr.objectStore('stores');
var req = stores.put({ id: 1, title: 'Store 1' });
request(req, tr).then(function() {});
```

### request(tr)

Reuse transaction.

```js
Promise.all([
  request(stores.put({ id: 1, title: 'Book 1' })),
  request(stores.put({ id: 2, title: 'Book 2' })),
  request(stores.put({ id: 3, title: 'Book 3' })),
]).then(function() {
  return request(tr); // wait transaction to complete
});
```

### request(req, fn)

Iterate through object store or index using cursors.

```js
var result = [];
var req = stores.openCursor();
request(req, iterator).then(function() {});

function iterator(cursor) {
  result.push(cursor.value);
  cursor.continue();
}
```

### request.Promise

By default it uses global `Promise` object,
you can replace it to any ES6 compatible implementation.

```js
var request = require('idb-request');
request.Promise = require('es6-promise');
```

## License

MIT
