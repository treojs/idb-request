import 'indexeddbshim'
import { expect } from 'chai'
import ES6Promise from 'es6-promise'
import Schema from 'idb-schema'
import { open, del } from 'idb-factory'
import { request, requestTransaction, requestCursor } from '../src'

// NOTE:
// Transaction reuse is not implemeneted right in Safari and WebsqlShim.
// So we create new transaction for each async tick to avoid issues.

describe('idb-request', () => {
  ES6Promise.polyfill()
  const dbName = 'idb-request'
  let db

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
    return open(dbName, schema.version(), schema.callback()).then((origin) => {
      db = origin
    })
  })

  before(() => del(dbName))
  afterEach(() => del(db))

  it('request(req, tr)', () => {
    const tr = db.transaction(['magazines'], 'readwrite')
    const magazines = tr.objectStore('magazines')
    const req = magazines.put({ name: 'My magazine' })

    return request(req, tr).then((id) => {
      expect(id).equal(1)
    })
  })

  it('request(cursor, iterator)', () => {
    const tr = db.transaction(['books'], 'readwrite')
    const wBooks = tr.objectStore('books')

    return Promise.all([
      request(wBooks.put({ title: 'Quarry Memories', author: 'Fred', isbn: 123456 })),
      request(wBooks.put({ title: 'Water Buffaloes', author: 'Fred', isbn: 234567 })),
      request(wBooks.put({ title: 'Bedrock Nights', author: 'Barney', isbn: 345678 })),
      requestTransaction(tr),
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
