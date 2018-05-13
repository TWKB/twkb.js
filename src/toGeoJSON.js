import readBuffer from './readBuffer'
import { POINT, LINESTRING, POLYGON, MULTIPOINT, MULTILINESTRING, MULTIPOLYGON, COLLECTION, MAX} from '../src/constants'
import { unknownType } from './errors'

function getTypeString(type) {
  if (type === POINT)
    return 'Point'
  else if (type === LINESTRING)
    return 'LineString'
  else if (type === POLYGON)
    return 'Polygon'
  else
    unknownType(type)
}

// Create GeoJSON Geometry object from TWKB type and coordinate array
function createGeometry (type, coordinates) {
  return {
    type: getTypeString(type),
    coordinates: coordinates
  }
}

// Create GeoJSON Feature object (intended for TWKB multi-types)
function createFeature (type, coordinates, id, ndims) {
  return {
    type: 'Feature',
    id: id,
    geometry: getTransform(type)(coordinates, ndims)
  }
}

// Create an array of GeoJSON feature objects
function createFeaturesFromMulti (type, geoms, ids, ndims) {
  return geoms.map((coordinates, i) =>
    createFeature(type, coordinates, ids ? ids[i] : undefined, ndims)
  )
}

// Create an array of GeoJSON feature objects
function createFeaturesFromCollection (geoms, ids, ndims) {
  return geoms.map((g, i) =>
    createFeature(g.type, g.coordinates, ids ? ids[i] : undefined, ndims)
  )
}

// Map TWKB type to correct transformation function from intermediate representation to GeoJSON object
function getTransform(type) {
  if (type === POINT)
    return (coordinates, ndims) =>
      createGeometry(POINT, toCoords(coordinates, ndims)[0])
  else if (type === LINESTRING)
    return (coordinates, ndims) =>
      createGeometry(LINESTRING, toCoords(coordinates, ndims))
  else if (type === POLYGON)
    return (coordinates, ndims) =>
      createGeometry(POLYGON, coordinates.map(c => toCoords(c, ndims)))
  else if (type === MULTIPOINT)
    return (geoms, ids, ndims) =>
      createFeaturesFromMulti(POINT, geoms, ids, ndims)
  else if (type === MULTILINESTRING)
    return (geoms, ids, ndims) =>
      createFeaturesFromMulti(LINESTRING, geoms, ids, ndims)
  else if (type === MULTIPOLYGON)
    return (geoms, ids, ndims) =>
      createFeaturesFromMulti(POLYGON, geoms, ids, ndims)
  else if (type === COLLECTION)
    return (geoms, ids, ndims) =>
      createFeaturesFromCollection(geoms, ids, ndims)
  else
    unknownType(type)
}

// TWKB flat coordinates to GeoJSON coordinates
function toCoords (coordinates, ndims) {
  const coords = []
  for (let i = 0, len = coordinates.length; i < len; i += ndims) {
    const pos = []
    for (let c = 0; c < ndims; ++c)
      pos.push(coordinates[i + c])
    coords.push(pos)
  }
  return coords
}

/**
 * Transform TWKB to GeoJSON FeatureCollection
 * @param {ArrayBuffer|Buffer} buffer Binary buffer containing TWKB data
 */
export default function toGeoJSON (buffer) {
  const ta_struct = {
    buffer: buffer,
    cursor: 0,
    bufferLength: buffer.byteLength || buffer.length,
    refpoint: new Int32Array(4 /* max dims */)
  }

  let features = []
  while (ta_struct.cursor < ta_struct.bufferLength) {
    const res = readBuffer(ta_struct, MAX)
    if (res.geoms)
      features = features.concat(getTransform(res.type)(res.geoms, res.ids, ta_struct.ndims))
    else
      features.push({ type: 'Feature', geometry: getTransform(ta_struct.type)(res, ta_struct.ndims) })
  }

  return {
    type: 'FeatureCollection',
    features: features
  }
}
