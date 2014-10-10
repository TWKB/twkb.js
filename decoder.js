"use strict";

//
// constants
//
var POINT = 1;
var LINESTRING = 2;
var POLYGON = 3;
var MULTIPOINT = 4;
var MULTILINESTRING = 5;
var MULTIPOLYGON = 6;
var AGG_POINT = 21;
var AGG_LINESTRING = 22;
var AGG_POLYGON = 23;

function ReadVarInt64(ta_struct) {
  var cursor = ta_struct.cursor,
      nVal = 0,
      nShift = 0,
      nByte;

  while(true)
  {
    nByte = ta_struct.ta[cursor];
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
}

function ReadVarSInt64(ta_struct) {
  var nVal = ReadVarInt64(ta_struct);
  /* un-zig-zag-ging */
  if ((nVal & 1) === 0)
    return ((nVal) >> 1);
  return -(nVal >> 1)-1;
}

function read_pa(ta_struct)
{

  var ndims = ta_struct.ndims;
  var factor = ta_struct.factor;
  var npoints = ta_struct.npoints;

  ta_struct.coords = [];

  for (var i = 0; i < npoints; i++)
  {
    ta_struct.coords[i] = []
    for (var j = 0; j < ndims; ++j)
    {
      ta_struct.refpoint[j] += ReadVarSInt64(ta_struct);
      ta_struct.coords[i][j] = ta_struct.refpoint[j]/factor;
    }
  }
  return 0;
}

function parse_point(ta_struct,layer)
{
  var id = null;
  if (ta_struct.id) {
    id = ReadVarSInt64(ta_struct);
  }
  ta_struct.npoints = 1;
  read_pa(ta_struct);
  ta_struct.addGeom(_build_geom(ta_struct.coords, "Point", id))
}

function parse_line(ta_struct,layer)
{
  var id = null;
  if (ta_struct.id) {
    id = ReadVarSInt64(ta_struct);
  }
  ta_struct.npoints = ReadVarInt64(ta_struct);
  read_pa(ta_struct);
  ta_struct.addGeom(_build_geom(ta_struct.coords, "LineString", id));
}

function parse_polygon(ta_struct,layer)
{
  var id = null;
  if (ta_struct.id) {
    id = ReadVarSInt64(ta_struct);
  }
  var nrings = ReadVarInt64(ta_struct);
  var rings = [];
  for (var ring = 0; ring < nrings; ring++) {
    ta_struct.npoints = ReadVarInt64(ta_struct);
    read_pa(ta_struct);
    rings.push(ta_struct.coords);
  }

  ta_struct.addGeom(_build_geom(rings, "Polygon", id))
}

function parse_multipoint(ta_struct,layer)
{
  var id = null;
  if (ta_struct.id) {
    id = ReadVarSInt64(ta_struct);
  }

  ta_struct.npoints = ReadVarInt64(ta_struct);
  read_pa(ta_struct);
  ta_struct.addGeom(_build_geom(ta_struct.coords, "MultiPoint", id));
}


function _build_geom(coords, type, id) {
  var g = {
    "coordinates": coords,
    "type": type
  };
  if (id !== null) {
    g.properties = {
      id : id
    };
  }
  return g;
}

function parse_multiline(ta_struct,layer)
{
  var id = null;
  if (ta_struct.id) {
    id = ReadVarSInt64(ta_struct);
  }

  var ngeoms = ReadVarInt64(ta_struct);

  var rings = [];
  for (var geom = 0; geom < ngeoms; ++geom) {
    ta_struct.npoints = ReadVarInt64(ta_struct);
    read_pa(ta_struct);
    rings.push(ta_struct.coords);
  }

  ta_struct.addGeom(_build_geom(rings, "MultiLineString", id));
}


function parse_multipolygon(ta_struct,layer) {

  var id = null, ngeoms, polygons = [];
  if (ta_struct.id) {
    id = ReadVarSInt64(ta_struct);
  }

  ngeoms = ReadVarInt64(ta_struct);
  polygons = [];

  for (var geom = 0; geom < ngeoms; ++geom)
  {
    var nrings = ReadVarInt64(ta_struct);
    var rings = [];
    for (var ring = 0; ring < nrings; ++ring)
    {
      ta_struct.npoints = ReadVarInt64(ta_struct);
      read_pa(ta_struct);
      rings.push(ta_struct.coords);
    }
    polygons.push(rings);
  }

  ta_struct.addGeom(_build_geom(polygons, "MultiPolygon", id));
}

function parse_agg_point(ta_struct) {
  var n_geometries = ReadVarInt64(ta_struct);
  for (var t=0;t < n_geometries; ++t) {
    parse_point(ta_struct);
  }
}

function parse_agg_line(ta_struct) {
  var n_geometries = ReadVarInt64(ta_struct);
  for (var t=0; t < n_geometries; t++) {
    parse_line(ta_struct);
  }
}

function parse_agg_polygon(ta_struct) {
  var n_geometries = ReadVarInt64(ta_struct);
  for (var t = 0; t < n_geometries; ++t) {
    parse_polygon(ta_struct);
  }
}


function parse_binary(ta)
{
  var flag, the_size;
  var ta_struct = {
    geometry: [],

    addGeom: function(g) {
      this.geometry.push(g);
    },

    toGeoJSON: function() {
      return this.geometry.map(function(g) {
        return {
          type: 'Feature',
          geometry: g
        };
      });
    }
  };

  ta_struct.ta = ta;
  ta_struct.length = ta.length;
  ta_struct.cursor = 0;

  /*
   * This variable will carry the last refpoint in a pointarray to the next pointarray.
   * It will hold one value per dimmension. For now we just give it the min INT32 number to indicate that we don't have a refpoint yet 
   */
  ta_struct.refpoint = new Int32Array(4);

  var n = 0;
  while (ta_struct.cursor < ta_struct.length) {
    // The first byte contains information about if there is id and geometry size delivered and in what precission the data is
    flag = ta[ta_struct.cursor];
    ++ta_struct.cursor;

    /* 1 if ID is used, 0 if not */
    ta_struct.id = flag & 0x01;

    /* 1 if there is sizes, 0 if not */
    ta_struct.sizes = flag & 0x02;

    /* precission gives the factor to divide the coordinate with, giving the right value and number of deciamal digits */
    var precision = (flag&0xF0) >> 4;
    ta_struct.factor = Math.pow(10, precision);

    if (ta_struct.sizes) {
      the_size = ReadVarInt64(ta_struct);
    }

    /* Here comes a byte containgin type and number of dimmension information */
    flag = ta[ta_struct.cursor];
    ++ta_struct.cursor;

    var typ = flag & 0x1F;
    ta_struct.ndims = (flag&0xE0) >> 5;

    // we store each geoemtry in a object, "geom"
    // reset refpoint and bbox
    for (var d = 0; d < ta_struct.ndims; ++d) {
      ta_struct.refpoint[d] = 0;
    }


    switch(typ) {
      case POINT:
        parse_point(ta_struct);
        ++n;
        break;

      case LINESTRING:
        parse_line(ta_struct);
        n++;
        break;

      case POLYGON:
        parse_polygon(ta_struct);
        n++;
        break;

      case MULTIPOINT:
        parse_multipoint(ta_struct);
        n++;
        break;

      case MULTILINESTRING:
        parse_multiline(ta_struct);
        break;

      case MULTIPOLYGON:
        parse_multipolygon(ta_struct);
        break;

      case AGG_POINT:
        parse_agg_point(ta_struct);
        break;

      case AGG_LINESTRING:
        parse_agg_line(ta_struct);
        break;

      case AGG_POLYGON:
        parse_agg_polygon(ta_struct);
        break;

      default:
        throw new Error("unknow geometry type: " + typ);
    }

  }

  return ta_struct;
}




/*
self.addEventListener('message', function(e) {
    var the_file = e.data.the_file;
    var hit_list= e.data.hit_list;
    var chunk = e.data.chunk;
    var layer = e.data.layer;
    var transform_values = e.data.transform_values;
    var start=chunk[0];
    var end=chunk[1];
    var blob=0;
    // Read each file synchronously as an ArrayBuffer and



    var reader = new FileReaderSync();

    parse_binary(new Uint8Array(reader.readAsArrayBuffer(the_file.slice(start, end))),hit_list,transform_values,layer);

    delete blob;
    self.close;
    }, false);
*/

module.exports = {
  parse: parse_binary
}
