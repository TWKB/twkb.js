"use strict";

//
// constants
//
var POINT  =  1;
var LINESTRING  =  2;
var POLYGON  =  3;
var MULTIPOINT  =  4;
var MULTILINESTRING  =  5;
var MULTIPOLYGON  =  6;
var COLLECTION = 7;

var MAX_VALUE =  Number.MAX_VALUE
var MIN_VALUE =  Number.MIN_VALUE

function TWKB(buffer, options) {
  if (buffer.byteLength === undefined) {
    throw new Error("buffer argment must be an ArrayBuffer");
  }
  options = options || {};
  var ta_struct = {};
  ta_struct.buffer = buffer;
  ta_struct.cursor = options.startReadingAt || 0;
  ta_struct.include_bbox = !!options.include_bbox;
  ta_struct.bufferLength = buffer.byteLength;
  this.ta_struct = ta_struct;
}

// constants
TWKB.POINT  =  POINT;
TWKB.LINESTRING  =  LINESTRING;
TWKB.POLYGON  =  POLYGON;
TWKB.MULTIPOINT  = MULTIPOINT;
TWKB.MULTILINESTRING  =  MULTILINESTRING;
TWKB.MULTIPOLYGON  =  MULTIPOLYGON;
TWKB.COLLECTION = COLLECTION;

TWKB.prototype = {

  /**
   * reads new feature or a group of them
   */
  next: function() {
    if (!this.eof()) {
      return this.readBuffer(this.ta_struct);
    }
    return null;
  },

  /**
   * returns true if the cursor is at the end of the buffer so no more features can be read
   */
  eof: function() {
    return this.ta_struct.cursor >= this.ta_struct.bufferLength;
  },

  skip: function() {
    throw new Error("not implemented");
  },

  toGeoJSON: function() {
    var geoms = {
      type: "FeatureCollection",
      features: []
    };

    function toCoords(f) {
      var coords = []
      for (var i = 0, len = f.coordinates.length; i < len; i += f.ndims) {
        var pos = []
        for (var c = 0; c < f.ndims; ++c) {
          pos.push(f.coordinates[i + c])
        }
        coords.push(pos);
      }
      return coords;
    }

    while (!this.eof()) {
      var res = this.next();
      var f = {}
      if (res.type === LINESTRING) {
        f.type = "LineString"
        f.coordinates = toCoords(res);
      }
      geoms.features.push({ type: "Feature", geometry: f });
    }
    return geoms;
  },

  readBuffer: function(ta_struct) {
      var flag;
      var has_z = 0;
      var has_m = 0;

      // geometry type and precision header
      flag = ta_struct.buffer[ta_struct.cursor];
      ta_struct.cursor++;

      var typ = flag & 0x0F;
      var precision_xy = this.unzigzag( (flag & 0xF0) >> 4);
      ta_struct.factors = [];
      ta_struct.factors[0] = ta_struct.factors[1] =  Math.pow(10, precision_xy);

      // Metadata header
      flag = ta_struct.buffer[ta_struct.cursor];
      ta_struct.cursor++;

      ta_struct.has_bbox = flag & 0x01;
      ta_struct.has_size = (flag & 0x02) >> 1;
      ta_struct.has_idlist = (flag & 0x04) >> 2;
      ta_struct.is_empty = (flag & 0x10) >> 4;
      var extended_dims = (flag & 0x08) >> 3;

      // the geometry has Z and/or M coordinates
      if (extended_dims) {
          var extended_dims_flag = ta_struct.buffer[ta_struct.cursor];
          ta_struct.cursor++;

          // Strip Z/M presence and precision from ext byte 
          has_z = (extended_dims_flag & 0x01);
          has_m = (extended_dims_flag & 0x02) >> 1;
          var precision_z = (extended_dims_flag & 0x1C) >> 2;
          var precision_m = (extended_dims_flag & 0xE0) >> 5;

          // Convert the precision into factor 
          if (has_z) {
            ta_struct.factors[2] = Math.pow(10, precision_z);
          }
          if (has_m) {
             ta_struct.factors[2 + has_z] = Math.pow(10, precision_m);
          }
          // store in the struct
          ta_struct.has_z = has_z;
          ta_struct.has_m = has_m;
      }

      ta_struct.ndims = 2 + has_z + has_m;

      // read the total size in bytes
      // The value is the size in bytes of the remainder of the geometry after the size attribute.
      if (ta_struct.has_size) {
        ta_struct.size = this.ReadVarInt64(ta_struct);
      }

      // bounding box in the format [xmin, deltax, ymin, deltay, zmin, deltaz]
      ta_struct.bbox = {};
      if (ta_struct.has_bbox) {
        ta_struct.bbox.min = [];
        ta_struct.bbox.max = [];
        for (var j = 0; j < ta_struct.ndims; j++) {
          ta_struct.bbox.min[j] = this.ReadVarSInt64(ta_struct)
          ta_struct.bbox.max[j] = this.ReadVarSInt64(ta_struct) + ta_struct.bbox.min[j];
        }
      } else {
        ta_struct.bbox.min = [MAX_VALUE,MAX_VALUE,MAX_VALUE,MAX_VALUE];
        ta_struct.bbox.max = [MIN_VALUE,MIN_VALUE,MIN_VALUE,MIN_VALUE];
      }

      // TWKB variable will carry the last refpoint in a pointarray to the next pointarray. It will hold one value per dimmension
      var buffer = new ArrayBuffer(4*ta_struct.ndims);
      ta_struct.refpoint = new Int32Array(buffer);
      for (var i = 0; i < ta_struct.ndims; i++) {
          ta_struct.refpoint[i] = 0;
      }

      // read the geometry
      var res = {}
      if(typ == POINT) {
        res = this.parse_point(ta_struct)
      } else if(typ == LINESTRING) {
        res = this.parse_line(ta_struct)
      } else if(typ == POLYGON) {
        res = this.parse_polygon(ta_struct)
      } else if(typ == MULTIPOINT) {
        res.type = MULTIPOINT;
        res.geoms = this.parse_multi(ta_struct, this.parse_point.bind(this));
      } else if(typ == MULTILINESTRING) {
        res.type = MULTILINESTRING;
        res.geoms = this.parse_multi(ta_struct, this.parse_line.bind(this));
      } else if(typ == MULTIPOLYGON) {
        res.type = MULTIPOLYGON;
        res.geoms = this.parse_multi(ta_struct, this.parse_polygon.bind(this));
      } else if(typ == COLLECTION) {
        res.type= COLLECTION;
        res.geoms = this.parse_multi(ta_struct, this.readBuffer.bind(this));
      } else {
        throw new Error("unknow type: " + typ);
      }
      res.ndims = ta_struct.ndims;
      if (ta_struct.has_bbox) {
        res.bbox = ta_struct.bbox;
      }

      if(ta_struct.has_size) {
        res.size = ta_struct.size;
      }
      return res;
  },

  ReadVarInt64: function(ta_struct) {
    var cursor = ta_struct.cursor,
        nVal = 0,
        nShift = 0,
        nByte;

    while(true) {
      nByte = ta_struct.buffer[cursor];
      if ((nByte & 0x80) === 0)
      {
        cursor++;
        ta_struct.cursor = cursor;
        return nVal | (nByte << nShift);
      }
      nVal = nVal | (nByte & 0x7f) << nShift;
      cursor ++;
      nShift += 7;
    }
  },

  ReadVarSInt64: function(ta_struct) {
    var nVal = this.ReadVarInt64(ta_struct);
    return this.unzigzag(nVal);
  },

  unzigzag: function (nVal) {
    if ((nVal & 1)  === 0) {
      return ((nVal) >> 1);
    }
    return -(nVal >> 1)-1;
  },

  parse_point: function (ta_struct) {
    var geom = {};
    geom.type = POINT;
    geom.coordinates = this.read_pa(ta_struct, 1);
    return geom;
  },

  parse_line: function (ta_struct) {
    var geom = {};
    geom.type = LINESTRING;
    var npoints = this.ReadVarInt64(ta_struct);
    geom.coordinates = this.read_pa(ta_struct, npoints);
    return geom;
  },

  parse_polygon: function (ta_struct) {
    var geom = {};
    geom.type = POLYGON;
    geom.coordinates = [];
    var nrings = this.ReadVarInt64(ta_struct);
    for (var ring = 0; ring < nrings; ++ring) {
      var npoints = this.ReadVarInt64(ta_struct);
      geom.coordinates[ring] = this.read_pa(ta_struct, npoints);
    }
    return geom;
  },

  parse_multi: function (ta_struct, parser) {
    var ngeoms = this.ReadVarInt64(ta_struct);
    var geoms = [];
    var IDlist = []
    if (ta_struct.has_idlist) {
      IDlist = this.readIDlist(ta_struct, ngeoms);
    }
    for (var i = 0; i < ngeoms; i++) {
      var geo = parser(ta_struct);
      if (ta_struct.has_idlist) {
        geo.id = IDlist[i];
      }
      geoms.push(geo);
    }
    return geoms;
  },

  read_pa: function(ta_struct, npoints) {

      var i, j;
      var ndims = ta_struct.ndims;
      var factors = ta_struct.factors;
      var coords = new Float32Array(npoints * ndims);

      for (i = 0; i < npoints; i++) {
        for (j = 0; j < ndims; j++) {
          ta_struct.refpoint[j] += this.ReadVarSInt64(ta_struct);
          coords[ndims * i + j] = ta_struct.refpoint[j]/factors[j];
        }
      }

      if(ta_struct.include_bbox && !ta_struct.has_bbox) {
        for (i = 0; i < npoints; i++) {
          for (j = 0; j < ndims; j++) { 
            var c  = coords[j * ndims + i]
            if(c < ta_struct.bbox.min[j]) {
              ta_struct.bbox.min[j] = c;
            }
            if(c > ta_struct.bbox.max[j]) {
              ta_struct.bbox.max[j] = c;
            }
          }
        }
      }
      return coords;
  },

  readIDlist: function(ta_struct, n) {
      var idList = [];
      for (var i = 0; i < n; i++) {
        idList.push(this.ReadVarSInt64(ta_struct));
      }
      return idList;
  }
}

module.exports = TWKB;















