import assert from 'assert'
import twkb from '../src/twkb'

import { POINT, LINESTRING, POLYGON, MULTIPOINT, MULTILINESTRING, MULTIPOLYGON, COLLECTION } from '../src/constants'

describe('twkb', function () {

  describe('toGeoJSON', function () {

    it('should decode point to geojson', function () {
      var g = twkb.toGeoJSON(Buffer.from('01000204', 'hex'))
      assert.deepEqual(g, {
         type: 'FeatureCollection',
         features: [
             {
                type: 'Feature',
                geometry: {
                  type: 'Point',
                  coordinates: [1, 2]
                }
             }
         ]
      })
    })

    it('should decode linestring to geojson', function () {
      var g = twkb.toGeoJSON(Buffer.from('02000202020808', 'hex'))
      assert.deepEqual(g, {
         type: 'FeatureCollection',
         features: [
             {
                type: 'Feature',
                geometry: {
                  type: 'LineString',
                  coordinates: [[1, 1], [5, 5]]
                }
             }
         ]
      })
    })

    it('should decode polygon to geojson', function () {
      var g = twkb.toGeoJSON(Buffer.from('03031b000400040205000004000004030000030500000002020000010100', 'hex'))
      assert.deepEqual(g, {
         type: 'FeatureCollection',
         features: [
             {
                type: 'Feature',
                geometry: {
                  type: 'Polygon',
                  coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]], [[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]]
                }
             }
         ]
      })
    })

    it('should decode multigeom with ids to geojson', function () {
      var g = twkb.toGeoJSON(Buffer.from('04070b0004020402000200020404', 'hex'))
      assert.deepEqual(g, {
         type: 'FeatureCollection',
         features: [
             {
                type: 'Feature',
                id: 0,
                geometry: {
                  type: 'Point',
                  coordinates: [0, 1]
                }
             },
             {
                type: 'Feature',
                id: 1,
                geometry: {
                  type: 'Point',
                  coordinates: [2, 3]
                }
             }
         ]
      })
    })

    it('should decode collection to geojson', function () {
      var g = twkb.toGeoJSON(Buffer.from('070402000201000002020002080a0404', 'hex'))
      assert.deepEqual(g, {
         type: 'FeatureCollection',
         features: [
             {
                type: 'Feature',
                id: 0,
                geometry: {
                  type: 'Point',
                  coordinates: [0, 1]
                }
             },
             {
                type: 'Feature',
                id: 1,
                geometry: {
                  type: 'LineString',
                  coordinates: [[4, 5], [6, 7]]
                }
             }
         ]
      })
    })

    it('should read multiple features', function () {
      var g = twkb.toGeoJSON(Buffer.from('0200020202080802000202020808', 'hex'))
      assert.equal(g.features.length, 2)
    })
  })

  describe('read', function () {
    it('should decode linestring', function () {
      // select encode(ST_AsTWKB('LINESTRING(1 1,5 5)'::geometry), 'hex')
      var f = twkb.read(Buffer.from('02000202020808', 'hex'))[0]
      assert.equal(f.type, LINESTRING)
      assert(!f.ndims)
      assert(!f.bbox)
      var coords = f.coordinates
      // assert.equal(f.size, undefined)
      assert.equal(coords[0], 1)
      assert.equal(coords[1], 1)
      assert.equal(coords[2], 5)
      assert.equal(coords[3], 5)
    })

    it('should decode linestring with bbox', function () {
      // select encode(ST_AsTWKB('LINESTRING(1 1,5 5)'::geometry, 0, 0, 0, true, true), 'hex')                                                                                                                                         ;
      var f = twkb.read(Buffer.from('020309020802080202020808', 'hex'))[0]
      assert.equal(f.type, LINESTRING)
      assert(!f.ndims)
      assert.deepEqual(f.bbox, [1, 1, 5, 5])
      var coords = f.coordinates
      assert.equal(coords[0], 1)
      assert.equal(coords[1], 1)
      assert.equal(coords[2], 5)
      assert.equal(coords[3], 5)
    })

    it('should decode multilinestring with bbox', function () {
      // select encode(ST_AsTWKB('MULTILINESTRING((1 1,5 5), (1 2, 3 4))'::geometry, 0, 0, 0, true, true), 'hex')
      var f = twkb.read(Buffer.from('05030f020802080202020208080207050404', 'hex'))[0]
      assert.equal(f.type, MULTILINESTRING)
      assert(!f.ndims)
      assert.deepEqual(f.bbox, [1, 1, 5, 5])
      assert.equal(f.geoms.length, 2)
      /*
      assert.deepEqual(f.bbox.min, [1, 1])
      assert.deepEqual(f.bbox.max, [5, 5])
      assert.equal(f.coordinates[0], 1)
      assert.equal(f.coordinates[1], 1)
      assert.equal(f.coordinates[2], 5)
      assert.equal(f.coordinates[3], 5)
      */
    })

    it('should decode a point', function () {
      // select encode(ST_AsTWKB('POINT(1 2)'::geometry), 'hex')
      var f = twkb.read(Buffer.from('01000204', 'hex'))[0]
      assert.equal(f.type, POINT)
      assert(!f.ndims)
      assert.equal(f.coordinates[0], 1)
      assert.equal(f.coordinates[1], 2)
    })

    it('should decode a polygon with holes', function () {
      // select encode(ST_AsTWKB('POLYGON((0 0,2 0,2 2, 0 2, 0 0), (0 0, 0 1, 1 1, 1 0, 0 0))'::geometry, 0, 0, 0, true, true), 'hex')
      var f = twkb.read(Buffer.from('03031b000400040205000004000004030000030500000002020000010100', 'hex'))[0]
      assert.equal(f.type, POLYGON)
      assert(!f.ndims)
    })

    it('should decode a multigeom with ids', function () {
      // select st_astwkb(array_agg(geom::geometry), array_agg(id)) from (select 0 as id, 'POINT(0 1)' as geom union all select 1 as id, 'POINT(2 3)'as geom) a;
      var f = twkb.read(Buffer.from('04070b0004020402000200020404', 'hex'))[0]
      assert.equal(f.type, MULTIPOINT)
      assert(!f.ndims)
      assert.deepEqual(f.bbox, [0, 1, 2, 3])
      assert.equal(f.geoms.length, 2)
      assert.equal(f.ids.length, 2)
      /*
      assert.deepEqual(f.geoms[0].coordinates[0], 0);
      assert.deepEqual(f.geoms[0].coordinates[1], 1);
      assert.equal(f.geoms[1].id, 1)
      assert.deepEqual(f.geoms[1].coordinates[0], 2);
      assert.deepEqual(f.geoms[1].coordinates[1], 3);
      */
    })

    it('should decode a collection', function () {
      // select st_astwkb(array_agg(geom::geometry), array_agg(id)) from (select 0 as id, 'POINT(0 1)' as geom union all select 1 as id, 'LINESTRING(4 5, 6 7)' as geom) a;
      var f = twkb.read(Buffer.from('070402000201000002020002080a0404', 'hex'))[0]
      assert.equal(f.type, COLLECTION)
      assert.equal(f.geoms.length, 2)
      assert.equal(f.geoms[0].type, POINT)
      assert.equal(f.geoms[1].type, LINESTRING)
    })

  })
})
