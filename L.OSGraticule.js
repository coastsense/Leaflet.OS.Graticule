// --- START OF L.OSGraticule.js with Cell Labels ---
L.OSGraticule = L.LayerGroup.extend({
    options: {
        interval: 1000,
        showLabels: true,     // For edge labels
        redraw: 'move',
        maxZoom: 15,
        minZoom: 12,
        gridLetterStyle: "color: #216fff; font-size:12px;", // Edge labels
        hidden: false,
        // New options for cell labels
        showCellLabels: true, // Set to true for debugging
        cellLabelStyle: "color: #e60000; font-size:10px; font-weight:bold; text-align: center; opacity: 0.7;",
        cellLabelDigits: 4 // 4 for 1km refs like SJ3291, 6 for SJ323911 (100m)
    },

    lineStyle: {
        stroke: true,
        color: '#216fff',
        opacity: 0.6,
        weight: 1,
        interactive: false,
        clickable: false
    },

    initialize: function(options) {
        L.LayerGroup.prototype.initialize.call(this);
        L.Util.setOptions(this, options);

        if (typeof Number.prototype.padLZ === 'undefined') {
            Number.prototype.padLZ = function(w) {
                var n = this.toString();
                for (var i=0; i<w-n.length; i++) n = '0' + n;
                return n;
            };
        }

        if (typeof proj4 === 'undefined') {
            console.error("L.OSGraticule: Proj4js library not found. Graticule cannot be drawn. Please include Proj4js.");
            this._proj4jsAvailable = false;
        } else {
            this._proj4jsAvailable = true;
            if (!proj4.defs['EPSG:27700']) {
                proj4.defs('EPSG:27700',
                    '+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 ' +
                    '+x_0=400000 +y_0=-100000 +ellps=airy ' +
                    '+towgs84=446.448,-125.157,542.060,0.1502,0.2470,0.8421,-20.4894 ' +
                    '+units=m +no_defs');
            }
        }
    },

    onAdd: function(map) {
        if (!this._proj4jsAvailable) {
            console.warn("L.OSGraticule: Not added to map because Proj4js is unavailable.");
            return this;
        }
        this._map = map;
        this.redraw();
        this._map.on('viewreset ' + this.options.redraw, this.redraw, this);
        this.eachLayer(map.addLayer, map);
    },

    onRemove: function(map) {
        if (!this._proj4jsAvailable) return;
        map.off('viewreset ' + this.options.redraw, this.redraw, this);
        this.eachLayer(this.removeLayer, this);
    },

    hide: function() {
        this.options.hidden = true;
        if (this._map) this.redraw();
    },

    show: function() {
        this.options.hidden = false;
        if (this._map) this.redraw();
    },

    redraw: function() {
        if (!this._proj4jsAvailable || !this._map) {
            return this;
        }

        var unpaddedMapBounds = this._map.getBounds();
        this.clearLayers();

        if (this.options.hidden) {
            return this;
        }

        var currentZoom = this._map.getZoom();
        if (!((currentZoom >= this.options.minZoom) && (currentZoom <= this.options.maxZoom))) {
            return this;
        }

        var nwLL = unpaddedMapBounds.getNorthWest();
        var neLL = unpaddedMapBounds.getNorthEast();
        var swLL = unpaddedMapBounds.getSouthWest();
        var seLL = unpaddedMapBounds.getSouthEast();

        try {
            var proj_nw = proj4('EPSG:4326', 'EPSG:27700', [nwLL.lng, nwLL.lat]);
            var proj_ne = proj4('EPSG:4326', 'EPSG:27700', [neLL.lng, neLL.lat]);
            var proj_sw = proj4('EPSG:4326', 'EPSG:27700', [swLL.lng, swLL.lat]);
            var proj_se = proj4('EPSG:4326', 'EPSG:27700', [seLL.lng, seLL.lat]);

            var eastings = [proj_nw[0], proj_ne[0], proj_sw[0], proj_se[0]];
            var northings = [proj_nw[1], proj_ne[1], proj_sw[1], proj_se[1]];

            this._min_visible_E_osgb = Math.min.apply(null, eastings);
            this._max_visible_E_osgb = Math.max.apply(null, eastings);
            this._min_visible_N_osgb = Math.min.apply(null, northings);
            this._max_visible_N_osgb = Math.max.apply(null, northings);

            var osgb_padding_m = this.options.interval;
            this._viewMinEasting = this._min_visible_E_osgb - osgb_padding_m;
            this._viewMaxEasting = this._max_visible_E_osgb + osgb_padding_m;
            this._viewMinNorthing = this._min_visible_N_osgb - osgb_padding_m;
            this._viewMaxNorthing = this._max_visible_N_osgb + osgb_padding_m;
            
            this.constructLinesAndLabels();

        } catch (e) {
            console.error("L.OSGraticule: Error during projection. Check CRS definitions and Proj4js.", e);
        }
        return this;
    },

    constructLinesAndLabels: function() { // Renamed for clarity
        var s = this.options.interval;

        var e_draw_min = Math.floor(this._viewMinEasting / s) * s;
        var e_draw_max = Math.ceil(this._viewMaxEasting / s) * s;
        var n_draw_max = Math.ceil(this._viewMaxNorthing / s) * s;
        var n_draw_min = Math.floor(this._viewMinNorthing / s) * s;

        var representative_N_for_E_edge_labels = (this._min_visible_N_osgb + this._max_visible_N_osgb) / 2;
        var representative_E_for_N_edge_labels = (this._min_visible_E_osgb + this._max_visible_E_osgb) / 2;

        var lines = [];
        var edgeLabels = [];
        var cellLabels = []; // New array for cell labels

        // Draw Lines and Edge Labels
        for (var e = e_draw_min; e <= e_draw_max; e += s) {
            var topOsPoint = [e, n_draw_max];
            var bottomOsPoint = [e, n_draw_min];
            try {
                var topLL_proj = proj4('EPSG:27700', 'EPSG:4326', topOsPoint);
                var bottomLL_proj = proj4('EPSG:27700', 'EPSG:4326', bottomOsPoint);
                var topLL = L.latLng(topLL_proj[1], topLL_proj[0]);
                var bottomLL = L.latLng(bottomLL_proj[1], bottomLL_proj[0]);
                lines.push(new L.Polyline([bottomLL, topLL], this.lineStyle));
                if (this.options.showLabels) {
                    var labelEastingText = gridrefNumToLet(e, representative_N_for_E_edge_labels, 4).e;
                    edgeLabels.push(this.buildXLabel(topLL, labelEastingText));
                }
            } catch (ex) { console.error("L.OSGraticule: Error unprojecting vertical line points.", ex); }
        }

        for (var n = n_draw_max; n >= n_draw_min; n -= s) {
            var leftOsPoint = [e_draw_min, n];
            var rightOsPoint = [e_draw_max, n];
            try {
                var leftLL_proj = proj4('EPSG:27700', 'EPSG:4326', leftOsPoint);
                var rightLL_proj = proj4('EPSG:27700', 'EPSG:4326', rightOsPoint);
                var leftLL = L.latLng(leftLL_proj[1], leftLL_proj[0]);
                var rightLL = L.latLng(rightLL_proj[1], rightLL_proj[0]);
                lines.push(new L.Polyline([leftLL, rightLL], this.lineStyle));
                if (this.options.showLabels) {
                    var labelNorthingText = gridrefNumToLet(representative_E_for_N_edge_labels, n, 4).n;
                    edgeLabels.push(this.buildYLabel(leftLL, labelNorthingText));
                }
            } catch (ex) { console.error("L.OSGraticule: Error unprojecting horizontal line points.", ex); }
        }

        // Draw Cell Labels if enabled
        if (this.options.showCellLabels) {
            for (var e_cell = e_draw_min; e_cell < e_draw_max; e_cell += s) {
                for (var n_cell = n_draw_min; n_cell < n_draw_max; n_cell += s) {
                    // SW corner of the cell is (e_cell, n_cell)
                    // Center of the cell for label placement
                    var cellCenterOsPoint = [e_cell + s / 2, n_cell + s / 2];
                    try {
                        var cellCenterLL_proj = proj4('EPSG:27700', 'EPSG:4326', cellCenterOsPoint);
                        var cellCenterLL = L.latLng(cellCenterLL_proj[1], cellCenterLL_proj[0]);

                        // Get full grid reference for the cell (based on its SW corner)
                        var cellGridRef = gridrefNumToLet(e_cell, n_cell, this.options.cellLabelDigits).full;
                        if (cellGridRef) { // Only add label if grid ref is valid
                           cellLabels.push(this.buildCellLabel(cellCenterLL, cellGridRef));
                        }
                    } catch (ex) { console.error("L.OSGraticule: Error projecting/creating cell label.", ex); }
                }
            }
        }

        lines.forEach(function(line) { this.addLayer(line); }, this);
        edgeLabels.forEach(function(label) { this.addLayer(label); }, this);
        cellLabels.forEach(function(label) { this.addLayer(label); }, this);
    },

    buildXLabel: function(latLng, labelText) { // Edge X label
      var mapDisplayBounds = this._map.getBounds().pad(-0.001); 
      var labelPos = L.latLng(mapDisplayBounds.getNorth(), latLng.lng);
      return L.marker(labelPos, {
        interactive: false, clickable: false,
        icon: L.divIcon({
          iconSize: [0, 0], iconAnchor: [-5, -5],
          className: 'leaflet-grid-label leaflet-grid-label-x', // Added specific class
          html: '<div style="' + this.options.gridLetterStyle + '">' + labelText + '</div>'
        })
      });
    },

    buildYLabel: function(latLng, labelText) { // Edge Y label
      var mapDisplayBounds = this._map.getBounds().pad(-0.001);
      var labelPos = L.latLng(latLng.lat, mapDisplayBounds.getWest());
      return L.marker(labelPos, {
        interactive: false, clickable: false,
        icon: L.divIcon({
          iconSize: [0, 0], iconAnchor: [-5, 25],
          className: 'leaflet-grid-label leaflet-grid-label-y', // Added specific class
          html: '<div style="' + this.options.gridLetterStyle + '">' + labelText + '</div>'
        })
      });
    },

    buildCellLabel: function(latLng, labelText) { // New method for cell labels
        return L.marker(latLng, {
            interactive: false,
            clickable: false,
            icon: L.divIcon({
                iconSize: [0, 0], // Icon size is effectively determined by HTML content
                iconAnchor: [20, 7], // Adjust to center the text; [width/2, height/2] roughly. Needs tuning.
                                     // Assuming label might be ~40px wide and ~14px high.
                className: 'leaflet-grid-label leaflet-cell-label', // Specific class
                html: '<div style="' + this.options.cellLabelStyle + '">' + labelText + '</div>'
            })
        });
    }
});

L.osGraticule = function(options) {
    return new L.OSGraticule(options);
};

function gridrefNumToLet(e, n, digits) {
  var e100k = Math.floor(e/100000), n100k = Math.floor(n/100000);
  if (e100k<0 || e100k>6 || n100k<0 || n100k>12) {
      return { full:'', let1:'', let2:'', e:'', n:'' }; // Return empty full string
  }
  var l1 = (19-n100k) - (19-n100k)%5 + Math.floor((e100k+10)/5);
  var l2 = (19-n100k)*5%25 + e100k%5;
  if (l1 > 7) l1++;
  if (l2 > 7) l2++;
  var let1 = String.fromCharCode(l1+'A'.charCodeAt(0));
  var let2 = String.fromCharCode(l2+'A'.charCodeAt(0));
  var letPair = let1 + let2;
  
  // Determine numeric part based on 'digits' option
  var eNumStr = "";
  var nNumStr = "";
  if (digits >= 2) { // National Grid letters
      // No numeric part if digits is 2 (e.g. SJ)
      if (digits >= 4) { // 1km numeric part
          var eVal_1k = Math.floor((e % 100000) / 1000);
          var nVal_1k = Math.floor((n % 100000) / 1000);
          // OS grid refs use 2 digits for 1km (e.g. 32 for 32000m, 91 for 91000m)
          // We need to get the digits based on the total number of digits requested.
          // gridrefNumToLet originally had logic Math.pow(10,5-digits/2)
          // For digits = 4 (1km square like SJ3291), we need the e.g. 32 from 332000 and 91 from 391000
          // So, (e % 100000) gives the within-100km-square easting.
          // Then divide by 10^(5 - (digits/2))
          // For digits=4, this is 10^(5-2) = 10^3 = 1000. So e.g. 32000 / 1000 = 32.
          var divisor = Math.pow(10, 5 - digits / 2);
          var eVal = Math.floor((e % 100000) / divisor);
          var nVal = Math.floor((n % 100000) / divisor);

          eNumStr = eVal.padLZ(digits/2);
          nNumStr = nVal.padLZ(digits/2);
      }
      // Could add digits=6 for 100m, digits=8 for 10m, digits=10 for 1m if needed later
  }

  var gridRef = letPair + eNumStr + nNumStr;
  
  // Return structure also needs numeric parts for edge labels if they still use .e and .n
  // For simplicity, let's ensure .e and .n are always the specific numeric parts for the given digits
  return {
    full: gridRef,
    let1: let1,
    let2: let2,
    e: eNumStr, // e.g., "32" for digits=4
    n: nNumStr  // e.g., "91" for digits=4
  };
}
// --- END OF L.OSGraticule.js ---