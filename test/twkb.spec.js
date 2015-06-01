var assert = require("assert")
var TWKB = require("../index")

function toArrayBuffer(buffer) {
    var ab = new ArrayBuffer(buffer.length);
    var view = new Uint8Array(ab);
    for (var i = 0; i < buffer.length; ++i) {
        view[i] = buffer[i];
    }
    return ab;
}


describe("TWKB", function() {
   describe("decode", function() {

     it("should decode linestring", function(){
       // select encode(ST_AsTWKB('LINESTRING(1 1,5 5)'::geometry), 'hex')
       var t = new TWKB(toArrayBuffer(new Buffer('02000202020808', 'hex')))
       var f = t.next()
       assert.equal(f.type, TWKB.LINESTRING)
       assert.equal(f.ndims, 2)
       assert.equal(f.bbox, undefined);
       assert.equal(f.size, undefined);
       assert.equal(f.coordinates[0], 1)
       assert.equal(f.coordinates[1], 1)
       assert.equal(f.coordinates[2], 5)
       assert.equal(f.coordinates[3], 5)
     });

     it("should decode linestring with bbox", function(){
      // select encode(ST_AsTWKB('LINESTRING(1 1,5 5)'::geometry, 0, 0, 0, true, true), 'hex')                                                                                                       ;
       var t = new TWKB(toArrayBuffer(new Buffer('020309020802080202020808', 'hex')))
       var f = t.next()
       assert.equal(f.type, TWKB.LINESTRING)
       assert.equal(f.ndims, 2)
       assert.equal(f.size, 9)
       assert.deepEqual(f.bbox.min, [1, 1])
       assert.deepEqual(f.bbox.max, [5, 5])
       assert.equal(f.coordinates[0], 1)
       assert.equal(f.coordinates[1], 1)
       assert.equal(f.coordinates[2], 5)
       assert.equal(f.coordinates[3], 5)
     });

     it("should decode multilinestring with bbox", function(){
      // select encode(ST_AsTWKB('MULTILINESTRING((1 1,5 5), (1 2, 3 4))'::geometry, 0, 0, 0, true, true), 'hex')
       var t = new TWKB(toArrayBuffer(new Buffer('05030f020802080202020208080207050404', 'hex')))
       var f = t.next()
       assert.equal(f.type, TWKB.MULTILINESTRING)
       assert.equal(f.ndims, 2)
       assert.deepEqual(f.bbox.min, [1, 1])
       assert.deepEqual(f.bbox.max, [5, 5])
       assert.equal(f.geoms.length, 2)
       assert.equal(f.geoms[0].type, TWKB.LINESTRING)
       assert.equal(f.geoms[0].type, TWKB.LINESTRING)
       /*
       assert.deepEqual(f.bbox.min, [1, 1])
       assert.deepEqual(f.bbox.max, [5, 5])
       assert.equal(f.coordinates[0], 1)
       assert.equal(f.coordinates[1], 1)
       assert.equal(f.coordinates[2], 5)
       assert.equal(f.coordinates[3], 5)
       */
     });

     it("should decode a point", function(){
       // select encode(ST_AsTWKB('POINT(1 2)'::geometry), 'hex')
       var t = new TWKB(toArrayBuffer(new Buffer('01000204', 'hex')))
       var f = t.next()
       assert.equal(f.type, TWKB.POINT)
       assert.equal(f.ndims, 2)
       assert.equal(f.coordinates[0], 1)
       assert.equal(f.coordinates[1], 2)
     });
   });
});
