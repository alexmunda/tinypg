import * as P from '../parser'
import * as T from '../types'
import { expect } from 'chai'
import * as Path from 'path'
import * as _ from 'lodash'

describe('parseSql', () => {
   let parse_result: T.SqlParseResult = null

   before(() => {
      parse_result = P.parseSql('SELECT * FROM users where id = :id and name = :name')
   })

   it('should replace the detected variables with postgres variable indexes', () => {
      expect(parse_result.parameterized_sql).to.equal('SELECT * FROM users where id = $1 and name = $2')
   })

   it('should return the mapping of postgres vars to names', () => {
      expect(parse_result.mapping).to.deep.equal([
         { name: 'id', index: 1 },
         { name: 'name', index: 2 }
      ])
   })

   describe('same var multiple times', () => {
      before(() => {
         parse_result = P.parseSql('SELECT * FROM users where id = :name and blah = :blah and name = :name and test = :test and something = :test')
      })

      it('should replace the detected variables with postgres variable indexes', () => {
         expect(parse_result.parameterized_sql).to.equal('SELECT * FROM users where id = $1 and blah = $2 and name = $1 and test = $3 and something = $3')
      })

      it('should return the mapping of postgres vars to names', () => {
         expect(parse_result.mapping).to.deep.equal([
            { name: 'name', index: 1 },
            { name: 'blah', index: 2 },
            { name: 'test', index: 3 }
         ])
      })
   })

   describe('type cast vars', () => {
      before(() => {
         parse_result = P.parseSql('SELECT * FROM users where id = :id::int and name = :name::text')
      })

      it('should replace the detected variables with postgres variable indexes', () => {
         expect(parse_result.parameterized_sql).to.equal('SELECT * FROM users where id = $1::int and name = $2::text')
      })

      it('should return the mapping of postgres vars to names', () => {
         expect(parse_result.mapping).to.deep.equal([
            { name: 'id', index: 1 },
            { name: 'name', index: 2 }
         ])
      })
   })

   describe('vars in a quoted string', () => {
      before(() => {
         parse_result = P.parseSql('SELECT * FROM users where created_on > \'2011-01-01 10:00:00\'::timestamptz')
      })

      it('should be ignored', () => {
         expect(parse_result.parameterized_sql).to.equal('SELECT * FROM users where created_on > \'2011-01-01 10:00:00\'::timestamptz')
      })
   })

   describe('vars after comments with quotes', () => {
      it('should ignore single line comments', () => {
         const parsed = P.parseSql(`
            SELECT * FROM users
            -- Ignore all things who aren't after a certain date
            WHERE created_on > '2011-01-01 10:00:00'::timestamptz
         `)

         expect(parsed.parameterized_sql).to.equal(`
            SELECT * FROM users
            -- Ignore all things who aren't after a certain date
            WHERE created_on > '2011-01-01 10:00:00'::timestamptz
         `)
      })

      it('should ignore multi-line comments', () => {
         const parsed = P.parseSql(`
            SELECT * FROM users
            /* Ignore all things who aren't after a certain :date
             * More lines
             */
            WHERE created_on > '2011-01-01 10:00:00'::timestamptz
         `)

         expect(parsed.parameterized_sql).to.equal(`
            SELECT * FROM users
            /* Ignore all things who aren't after a certain :date
             * More lines
             */
            WHERE created_on > '2011-01-01 10:00:00'::timestamptz
         `)
      })
   })

   describe('comments in strings', () => {
      it('should ignore multi-line comments', () => {
         const parsed = P.parseSql(`
            SELECT * FROM users
            /* Ignore all things who aren't after a certain :date
             * More lines
             */
            WHERE some_text LIKE 'foo -- bar' AND :date::timestamptz
         `)

         expect(parsed.parameterized_sql).to.equal(`
            SELECT * FROM users
            /* Ignore all things who aren't after a certain :date
             * More lines
             */
            WHERE some_text LIKE 'foo -- bar' AND $1::timestamptz
         `)
      })
   })

   describe('indexing objects', () => {
      before(() => {
         parse_result = P.parseSql('SELECT * FROM users where id = :id.foo and name = :name.bar')
      })

      it('should replace the detected variables with postgres variable indexes', () => {
         expect(parse_result.parameterized_sql).to.equal('SELECT * FROM users where id = $1 and name = $2')
      })

      it('should return the mapping of postgres vars to names', () => {
         expect(parse_result.mapping).to.deep.equal([
            { name: 'id.foo', index: 1 },
            { name: 'name.bar', index: 2 }
         ])
      })
   })
})

describe('parseFiles', () => {
   let result: T.SqlFile[]

   beforeEach(() => {
      result = P.parseFiles([ Path.join(__dirname, './sql') ])
   })

   it('should parse files', () => {
      const parse_file_marker = _.find(result, x => x.key.indexOf('parse_file_test_marker') != -1)
      expect(parse_file_marker.name).to.equal('a_parse_file_test_marker')
      expect(parse_file_marker.relative_path).to.equal('a/parse_file_test_marker.sql')
   })

   it('shoul correctly format root level file names', () => {
      const root_level_file = _.find(result, x => x.key.indexOf('root_level_sql_file') != -1)
      expect(root_level_file.name).to.equal('root_level_sql_file')
      expect(root_level_file.relative_path).to.equal('root_level_sql_file.sql')
   })
})
