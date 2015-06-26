var constants = require('./constants');
var readBuffer = require('./readBuffer');
var eof = require('./readBuffer');

module.exports = function(buffer, startOffset, howMany) {
  var ta_struct = {
    buffer: buffer,
    cursor: startOffset === undefined ? 0 : startOffset,
    bufferLength: buffer.byteLength,
    refpoint: new Int32Array(4 /* max dims */)
  };
    
  var features = [];
  
  while (ta_struct.cursor < ta_struct.bufferLength) {
    readBuffer(ta_struct);
    var geometry = {};
    switch(ta_struct.type) {
      case constants.POINT:
        geometry.type = "Point"
        geometry.coordinates = toCoords(ta_struct.res, ta_struct.ndims)[0];
        break;
      case constants.LINESTRING:
        geometry.type = "LineString"
        geometry.coordinates = toCoords(ta_struct.res, ta_struct.ndims);
        break;
      case constants.POLYGON:
        geometry.type = "Polygon"
        var c = ta_struct.res;
        geometry.coordinates = [];
        c.forEach(function(c) {
          geometry.coordinates.push(toCoords(c, ta_struct.ndims));
        })
        break;
    }
    features.push({ type: "Feature", geometry: geometry });
  }
  
  return {
    type: 'FeatureCollection',
    features: features
  };
}


var toCoords = function(coordinates, ndims) {
    var coords = []
    for (var i = 0, len = coordinates.length; i < len; i += ndims) {
      var pos = []
      for (var c = 0; c < ndims; ++c) {
        pos.push(coordinates[i + c])
      }
      coords.push(pos);
    }
    return coords;
  }
