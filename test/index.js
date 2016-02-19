import 'indexeddbshim'
import 'regenerator/runtime'
import { expect } from 'chai'
import ES6Promise from 'es6-promise'
import Schema from 'idb-schema'
import { open, del } from 'idb-factory'
import map from 'lodash.map'
import range from 'idb-range'
import { request, requestTransaction, requestCursor, mapCursor } from '../src'

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

  beforeEach(async () => {
    db = await open(dbName, schema.version(), schema.callback())
  })
  before(() => del(dbName))
  afterEach(() => del(db || dbName))

  it('#request(req, tr)', async () => {
    const tr = db.transaction(['magazines'], 'readwrite')
    const magazines = tr.objectStore('magazines')
    const req = magazines.put({ name: 'My magazine' })

    const id = await request(req, tr)
    expect(id).equal(1)
  })

  it('#requestCursor(req, iterator)', async () => {
    const tr = db.transaction(['books'], 'readwrite')
    const wBooks = tr.objectStore('books')

    await Promise.all([
      request(wBooks.put({ title: 'Quarry Memories', author: 'Fred', isbn: 123456 })),
      request(wBooks.put({ title: 'Water Buffaloes', author: 'Fred', isbn: 234567 })),
      request(wBooks.put({ title: 'Bedrock Nights', author: 'Barney', isbn: 345678 })),
      requestTransaction(tr),
    ])

    const rBooks = db.transaction(['books'], 'readonly').objectStore('books')
    const req1 = rBooks.index('byAuthor').openCursor(null, 'nextunique')
    const res1 = []
    await requestCursor(req1, (cursor) => {
      res1.push(cursor.value)
      cursor.continue()
    })

    expect(map(res1, 'author')).eql(['Barney', 'Fred'])

    const req2 = db.transaction(['books'], 'readonly').objectStore('books').openCursor()
    const res2 = []
    await requestCursor(req2, (cursor, stop) => {
      res2.push(cursor.value)
      if (res2.length >= 2) stop()
      else cursor.continue()
    })
    expect(map(res1, 'isbn')).eql([345678, 123456])
  })

  it('fixes unique indexes iterator', async () => {
    const tr = db.transaction(['magazines'], 'readwrite')
    const wMagazines = tr.objectStore('magazines')

    await Promise.all([
      request(wMagazines.put({ id: 1, publisher: 'P1', frequency: 12 })),
      request(wMagazines.put({ id: 2, publisher: 'P2', frequency: 12 })),
      request(wMagazines.put({ id: 3, publisher: 'P1', frequency: 24 })),
      request(wMagazines.put({ id: 4, publisher: 'P1', frequency: 52 })),
      requestTransaction(tr),
    ])

    const iterator = (cursor, result) => {
      result.push(cursor.value)
      cursor.continue()
    }
    const rMagazines = db.transaction(['magazines'], 'readonly').objectStore('magazines')
    const req1 = rMagazines.index('byFrequency').openCursor(range({ lte: 30 }), 'prevunique')
    const req2 = rMagazines.index('byPublisher').openCursor(null, 'prevunique')

    const [result1, result2] = await Promise.all([
      mapCursor(req1, iterator),
      mapCursor(req2, iterator),
    ])

    expect(map(result1, 'id')[0]).equal(3)
    expect(result1).length(2)
    expect(map(result2, 'id')[0]).equal(2)
    expect(result2).length(2)
  })
})
