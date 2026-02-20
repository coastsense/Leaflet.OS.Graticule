# Leaflet.OS.Graticule
Add UK Ordnance Survey style 1km grid squares to your Leaflet maps, with optional cell labels showing full OS grid references (e.g. "SJ3291").

Demo: http://htmlpreview.github.io/?https://github.com/jonshutt/Leaflet.OS.Graticule/blob/master/demo.html

Dependencies
------------
- [Leaflet](https://leafletjs.com/) (tested with v1.9.4)
- [Proj4js](http://proj4js.org/) (tested with v2.17.0) - required for coordinate projection between WGS84 and OSGB36 (EPSG:27700)

Usage
-----

Include the required libraries before `L.OSGraticule.js`:

```html
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.17.0/proj4.js"></script>
<script src="L.OSGraticule.js"></script>
```

Then add the graticule to your map:

```JavaScript
    var map = L.map('map',{
      center: [53.4084, -2.9916],
      zoom: 14,
    });

    L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
      }
    ).addTo(map);

    L.osGraticule({ showCellLabels: true }).addTo(map);
```

Notes
-----
This is a UK-based grid. It will continue to display outside the lat/lng bounds of the UK, however it will become more and more distorted until at some point it stops displaying.

Options
-------
- **interval**: Default = `1000`. Draws a grid line every 1000m.
- **showLabels**: Default = `true`. Displays numeric Easting and Northing labels on the grid edges.
- **showCellLabels**: Default = `true`. Displays the full OS grid reference (e.g. "SJ3291") in the centre of each grid cell.
- **cellLabelStyle**: Default = `'color: #e60000; font-size:10px; font-weight:bold; text-align: center; opacity: 0.7;'`. CSS string to style cell labels.
- **cellLabelDigits**: Default = `4`. Controls grid reference precision: `4` for 1km refs (e.g. SJ3291), `6` for 100m refs (e.g. SJ323911).
- **redraw**: Default = `'move'`. Sets when the grid is redrawn.
- **maxZoom**: Default = `15`. Maximum zoom level at which the grid is drawn.
- **minZoom**: Default = `12`. Minimum zoom level at which the grid is drawn.
- **gridLetterStyle**: Default = `'color: #216fff; font-size:12px;'`. CSS string to style the edge labels.
- **hidden**: Default = `false`. Set to `true` to hide the grid. Can be toggled at runtime via `hide()` and `show()` methods.

Code inspiration from https://github.com/ablakey/Leaflet.SimpleGraticule
