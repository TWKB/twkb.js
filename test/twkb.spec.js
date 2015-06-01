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
   describe("next", function() {
       it("should work", function(){
         var t= new TWKB(toArrayBuffer(new Buffer('02000202020808', 'hex')))
         var f = t.next()
         assert.equal(f.type, TWKB.LINESTRING)
       });
   });
});
