const Promise = require('es6-promise').Promise
const expect = require('chai').expect
const Schema = require('idb-schema')
const request = require('../lib')
if (!global.indexedDB) require('indexeddbshim')
const idb = global.indexedDB

// force to use a Promise implementation, built on top of microtasks, allowing transaction reuse
// https://stackoverflow.com/questions/28388129/inconsistent-interplay-between-indexeddb-transactions-and-promises
// http://lists.w3.org/Archives/Public/public-webapps/2014AprJun/0811.html
request.Promise = Promise

// NOTE:
// Transaction reuse is not implemeneted right in Safari and WebsqlShim.
// So we create new transaction for each request to avoid issues.

describe('idb-request', function() {
  let db
  const dbName = 'idb-request1'
  const schema = new Schema()
  .version(1)
    .addStore('books', { key: 'isbn' })
    .addIndex('byTitle', 'title', { unique: true })
    .addIndex('byAuthor', 'author')
  .version(2)
    .getStore('books')
    .addIndex('byYear', 'year')
  .version(3)
    .addStore('magazines', { key: 'id', increment: true })
    .addIndex('byPublisher', 'publisher')
    .addIndex('byFrequency', 'frequency')

  beforeEach(() => {
    const req = idb.open(dbName, schema.version())
    req.onupgradeneeded = schema.callback()
    return request(req).then((origin) => {
      db = origin
    })
  })

  afterEach(() => {
    db.close()
    return timeout().then(() => {
      const req = idb.deleteDatabase(db.name)
      return request(req)
    })

    // wrap setTimeout to promise, to handle block errors with mocha
    function timeout() {
      return new Promise((resolve) => {
        setTimeout(() => { resolve() }, 50)
      })
    }
  })

  it('request(db)', () => {
    expect(db.name).equal(dbName)
    expect(db.version).equal(schema.version())
    expect([].slice.call(db.objectStoreNames)).eql(['books', 'magazines'])
  })

  it('request(req)', () => {
    let wBook = db.transaction(['books'], 'readwrite').objectStore('books')
    return Promise.all([
      request(wBook.put({ title: 'Quarry Memories', author: 'Fred', isbn: 123456 })),
      request(wBook.put({ title: 'Water Buffaloes', author: 'Fred', isbn: 234567 })),
      request(wBook.put({ title: 'Bedrock Nights', author: 'Barney', isbn: 345678 })),
    ]).then(() => {
      const rBooks = db.transaction(['books'], 'readonly').objectStore('books')
      return request(rBooks.count()).then((count) => {
        expect(count).equal(3)
      })
    })
  })

  it('request(req, tr)', () => {
    const tr = db.transaction(['magazines'], 'readwrite')
    const magazines = tr.objectStore('magazines')
    const req = magazines.put({ name: 'My magazine' })
    return request(req, tr).then((id) => {
      expect(id).equal(1)
    })
  })

  it('request(tr)', () => {
    const tr = db.transaction(['magazines'], 'readwrite')
    const magazines = tr.objectStore('magazines')

    return Promise.all([
      request(magazines.put({ id: 1, name: 'Magazine 1' })),
      request(magazines.put({ id: 2, name: 'Magazine 2' })),
      request(tr)
    ])
  })

  it('request(cursor, iterator)', () => {
    const wBooks = db.transaction(['books'], 'readwrite').objectStore('books')
    return Promise.all([
      request(wBooks.put({ title: 'Quarry Memories', author: 'Fred', isbn: 123456 })),
      request(wBooks.put({ title: 'Water Buffaloes', author: 'Fred', isbn: 234567 })),
      request(wBooks.put({ title: 'Bedrock Nights', author: 'Barney', isbn: 345678 })),
    ]).then(() => {
      const rBooks = db.transaction(['books'], 'readonly').objectStore('books')
      const req = rBooks.openCursor()
      const result = []

      return request(req, iterator).then(() => {
        expect(result).length(3)
      })

      function iterator(cursor) {
        result.push(cursor.value)
        cursor.continue()
      }
    })
  })

  it('handle errors', function() {
    return request(idb.open(dbName, 2)).catch(function(err) {
      expect(err.name).equal('VersionError')
      const wBooks1 = db.transaction(['books'], 'readwrite').objectStore('books')
      return request(wBooks1.add({ isbn: 1 })).then(function() {
        const wBooks2 = db.transaction(['books'], 'readwrite').objectStore('books')
        return request(wBooks2.add({ isbn: 1 })).catch(function(err) {
          expect(err.name).equal('ConstraintError')
        })
      })
    })
  })
})
