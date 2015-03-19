# idb-request

Transform IndexedDB request-like object to `Promise`.

## Example

Example using [ES7 async/await syntax](https://github.com/lukehoban/ecmascript-asyncawait),
which you can use today with [6to5](http://6to5.org/):

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

```js
// create request and wait transaction to complete
var tr = db.transaction(['stores'], 'readwrite');
var stores = tr.objectStore('stores');
var req = stores.put({ id: 1, title: 'Store 1' });
request(req, tr).then(function() {});
```

### request(tr)

Reuse transaction

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

Iterate using cursors.

```js
var req = stores.openCursor();
var result = [];
request(req, iterator).then(function() {});

function iterator(cursor) {
  result.push(cursor.value);
  cursor.continue();
}
```

### request.Promise

[1]: https://developer.mozilla.org/en-US/docs/Web/API/IDBRequest
[2]: https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction
[3]: https://developer.mozilla.org/en-US/docs/Web/API/IDBCursor
[4]: http://www.html5rocks.com/en/tutorials/es6/promises/
