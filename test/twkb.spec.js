var assert = require('assert')
var twkb = require('../index')

var MAX_VALUE = Number.MAX_VALUE
var MIN_VALUE = Number.MIN_VALUE
var FULL_BBOX = {
  min: [MAX_VALUE, MAX_VALUE, MAX_VALUE, MAX_VALUE],
  max: [MIN_VALUE, MIN_VALUE, MIN_VALUE, MIN_VALUE]
}

describe('twkb', function () {

  describe('toGeoJSON', function () {

    it('should decode point to geojson', function () {
      var g = twkb.toGeoJSON(new Buffer('01000204', 'hex'))
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
      var g = twkb.toGeoJSON(new Buffer('02000202020808', 'hex'))
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
      var g = twkb.toGeoJSON(new Buffer('03031b000400040205000004000004030000030500000002020000010100', 'hex'))
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
      var g = twkb.toGeoJSON(new Buffer('04070b0004020402000200020404', 'hex'))
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
      var g = twkb.toGeoJSON(new Buffer('070402000201000002020002080a0404', 'hex'))
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
      var g = twkb.toGeoJSON(new Buffer('0200020202080802000202020808', 'hex'))
      assert.equal(g.features.length, 2)
    })
  })

  // disable decode tests until supported...
  var undescribe = function () {}

  undescribe('decode', function () {
    it('should decode linestring', function () {
      // select encode(ST_AsTWKB('LINESTRING(1 1,5 5)'::geometry), 'hex')
      var t = new TWKB(new Buffer('02000202020808', 'hex'))
      var f = t.next()
      assert.equal(f.type(), TWKB.LINESTRING)
      assert.equal(f.ndims(), 2)
      assert.deepEqual(f.bbox(), FULL_BBOX)
      var coords = f.coordinates()
      // assert.equal(f.size, undefined)
      assert.equal(coords[0], 1)
      assert.equal(coords[1], 1)
      assert.equal(coords[2], 5)
      assert.equal(coords[3], 5)
    })

    it('should decode linestring with bbox', function () {
      // select encode(ST_AsTWKB('LINESTRING(1 1,5 5)'::geometry, 0, 0, 0, true, true), 'hex')                                                                                                                                         ;
      var t = new TWKB(new Buffer('020309020802080202020808', 'hex'))
      var f = t.next()
      assert.equal(f.type(), TWKB.LINESTRING)
      assert.equal(f.ndims(), 2)
      // assert.equal(f.size, 9)
      assert.deepEqual(f.bbox().min, [1, 1])
      assert.deepEqual(f.bbox().max, [5, 5])
      var coords = f.coordinates()
      assert.equal(coords[0], 1)
      assert.equal(coords[1], 1)
      assert.equal(coords[2], 5)
      assert.equal(coords[3], 5)
    })

    it('should decode multilinestring with bbox', function () {
     // select encode(ST_AsTWKB('MULTILINESTRING((1 1,5 5), (1 2, 3 4))'::geometry, 0, 0, 0, true, true), 'hex')
      var t = new TWKB(new Buffer('05030f020802080202020208080207050404', 'hex'))
      var f = t.next()
      assert.equal(f.type(), TWKB.MULTILINESTRING)
      assert.equal(f.ndims(), 2)
      assert.deepEqual(f.bbox().min, [1, 1])
      assert.deepEqual(f.bbox().max, [5, 5])
      assert.equal(f.coordinates().length, 2)
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
      var t = new TWKB(new Buffer('01000204', 'hex'))
      var f = t.next()
      assert.equal(f.type(), TWKB.POINT)
      assert.equal(f.ndims(), 2)
      assert.equal(f.coordinates()[0], 1)
      assert.equal(f.coordinates()[1], 2)
    })

    it('should decode a polygon with holes', function () {
      // select encode(ST_AsTWKB('POLYGON((0 0,2 0,2 2, 0 2, 0 0), (0 0, 0 1, 1 1, 1 0, 0 0))'::geometry, 0, 0, 0, true, true), 'hex')
      var t = new TWKB(new Buffer('03031b000400040205000004000004030000030500000002020000010100', 'hex'))
      var f = t.next()
      assert.equal(f.type(), TWKB.POLYGON)
      assert.equal(f.ndims(), 2)
    })

    it('should decode a multigeom with ids', function () {
      // select st_astwkb(array_agg(geom::geometry), array_agg(id)) from (select 0 as id, 'POINT(0 1)' as geom union all select 1 as id, 'POINT(2 3)'as geom) a;
      var t = new TWKB(new Buffer('04070b0004020402000200020404', 'hex'))
      var f = t.next()
      assert.equal(f.type(), TWKB.MULTIPOINT)
      assert.equal(f.ndims(), 2)
      assert.deepEqual(f.bbox().min, [0, 1])
      assert.deepEqual(f.bbox().max, [2, 3])
      assert.equal(f.coordinates().length, 2)
      assert.equal(f.ids().length, 2)
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
      var t = new TWKB(new Buffer('070402000201000002020002080a0404', 'hex'))
      var f = t.next()
      assert.equal(f.type(), TWKB.COLLECTION)
      assert.equal(f.features().length, 2)
      assert.equal(f.features()[0].type(), TWKB.POINT)
      assert.equal(f.features()[1].type(), TWKB.LINESTRING)

    })

  })
})
