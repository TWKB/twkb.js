
this library allows to decode TWKB.
warning: this is a preview and may change without any notice

## usage

```
TWKB.parse(data).toGeoJSON()
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
    var b = TWKB.parse(new Uint8Array(data))
    L.geoJson({ features: b.toGeoJSON(), type: "FeatureSet"}).addTo(map)
})
```

## license

see LICENSE file
