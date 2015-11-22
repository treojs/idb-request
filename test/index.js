import 'indexeddbshim'
import { expect } from 'chai'
import ES6Promise from 'es6-promise'
import Schema from 'idb-schema'
import { request, requestTransaction, requestCursor } from '../src'

// Setup global `Promise`
ES6Promise.polyfill()

// NOTE:
// Transaction reuse is not implemeneted right in Safari and WebsqlShim.
// So we create new transaction for each async tick to avoid issues.

describe('idb-request', () => {
  let db

  const idb = global.indexedDB || global.webkitIndexedDB
  const dbName = 'idb-request'

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
    return new Promise((resolve) => setTimeout(resolve, 100)).then(() => {
      return request(idb.deleteDatabase(dbName))
    })
  })

  it('request(req)', () => {
    const wBooks = db.transaction(['books'], 'readwrite').objectStore('books')
    return Promise.all([
      request(wBooks.put({ title: 'Quarry Memories', author: 'Fred', isbn: 123456 })),
      request(wBooks.put({ title: 'Water Buffaloes', author: 'Fred', isbn: 234567 })),
      request(wBooks.put({ title: 'Bedrock Nights', author: 'Barney', isbn: 345678 })),
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
      requestTransaction(tr),
    ]).then(() => {
      const req = db.transaction(['magazines'], 'readonly').objectStore('magazines').count()
      return request(req).then((count) => {
        expect(count).equal(2)
      })
    })
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

      return requestCursor(req, iterator).then(() => {
        expect(result).length(3)
      })

      function iterator(cursor) {
        result.push(cursor.value)
        cursor.continue()
      }
    })
  })
})
