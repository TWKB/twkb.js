# twkb

This library allows to decode TWKB.

WARNING: this is a preview and may change without any notice

## Usage

```
twkb.toGeoJSON(buffer)
```

## Building

```
npm install
npm run build
```

## Wxample

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
    var g = new twkb.toGeoJSON(new Uint8Array(data))
    L.geoJson({ features: g, type: "FeatureSet"}).addTo(map)
})
```

# API

## twkb 

### twkb.toGeoJSON(buffer)

returns valid geojson for the features


## License

see LICENSE file
