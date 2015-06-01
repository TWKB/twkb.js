
### Note: 

This library is outdated and doesn't follow the new specification.
It will be updated soon. 
### End Note


this library allows to decode TWKB.
warning: this is a preview and may change without any notice

## usage

```
new TWKB(buffer).toGeoJSON()
```

## building

```
npm install
npm run build
```

## example

this is a simple example using leaflet

```
function get(url, callback) {
  var oReq = new XMLHttpRequest();
  oReq.open("GET", url, true);
  oReq.responseType = "arraybuffer";

  oReq.onload = function (oEvent) {
    callback(oReq.response);
  };

  oReq.send(null);
}

var map = L.map('map').setView([40.505, -3.09], 5);

get('file.twkb', function(data) {
    var b = new TWKB(new Uint8Array(data))
    L.geoJson({ features: b.toGeoJSON(), type: "FeatureSet"}).addTo(map)
})
```

## API

### toGeoJSON()

returns valid geojson for the feature

### next() -> Feature | FeatureGroup
reads next feature, see ``Feature``

### Feature
it's a an object with the following attributes

- ``coordinates``: array of coordinates with format [x,y,z, x,y,z ...]. If ``type`` is a polygon
  this is an array of coordinates for external an internal ring. As general rule this array follows
  the same rules that ``coordinates`` in geojson geometry
- ``bbox``: geometry bounding box in format ``{ min: [minx, miny, minz], max: [maxx, maxy, maxz] }``
- ``size``: size in bytes (see TWKB standarnd)
- ``ndims``: dimensions, 2 for XY, 3 for XYZ
- ``type``: one of the following: TWKB.POINT, TWKB.LINESTRING ...

### FeatureGroup
Same than feature but instead of having ``coordinates`` it constains a ``geoms`` array with
``Feature`` instances



## license

see LICENSE file
