const animNamespace = {
  mapboxToken:
    "pk.eyJ1Ijoibndhamlha3UiLCJhIjoiY2x3amphbXZ2MG02YTJscDRmcXE3MDllZCJ9.RwnwQjJ1U0Y95kTvA-4i7g",
  shapefiles: {
    1800: "states/states1800.json",
    1810: "states/states1810.json",
    1820: "states/states1820.json",
    1830: "states/states1830.json",
    1840: "states/states1840.json",
    1850: "states/states1850.json",
    1860: "states/states1860.json",
    1870: "states/states1870.json",
    1880: "states/states1880.json",
    1890: "states/states1890.json",
    1900: "states/state1900.geojson",
    1910: "states/states1920.geojson",
  },
  init: function () {
    console.log("Initializing animNamespace");

    mapboxgl.accessToken = this.mapboxToken;

    this.map = new mapboxgl.Map({
      container: "map",
      style: {
        version: 8,
        sources: {
          esriWorldPhysical: {
            type: "raster",
            tiles: [
              "https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}",
            ],
            tileSize: 256,
          },
        },
        glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
        layers: [
          {
            id: "esriWorldPhysical-layer",
            type: "raster",
            source: "esriWorldPhysical",
            minzoom: 0,
            maxzoom: 22,
          },
        ],
      },
      center: [-98.35, 39.5],
      zoom: 4,
    });

    this.map.on("load", () => {
      console.log("Map loaded, loading initial data for 1800");
      this.loadShapefile(1800);
    });

    const slider = document.getElementById("slider-animation");
    const yearLabel = document.getElementById("year-label-animation");

    slider.addEventListener("input", (e) => {
      const year = e.target.value;
      yearLabel.textContent = `Year: ${year}`;
      console.log(`Slider input changed, loading data for year: ${year}`);
      this.loadShapefile(year);
    });
  },
  getNameField: function (data) {
    const possibleFields = ["STATENAM", "STATE_ABBR", "LABEL"];
    const properties = data.features[0].properties;
    for (let field of possibleFields) {
      if (properties.hasOwnProperty(field)) {
        return field;
      }
    }
    return "name"; // Fallback if no match is found
  },
  getCentroid: function (geometry) {
    if (geometry.type === "Polygon") {
      return turf.centroid(geometry).geometry.coordinates;
    } else if (geometry.type === "MultiPolygon") {
      let largestPolygon = geometry.coordinates.reduce((a, b) => {
        return turf.area(turf.polygon(a)) > turf.area(turf.polygon(b)) ? a : b;
      });
      return turf.centroid(turf.polygon(largestPolygon)).geometry.coordinates;
    }
  },
  prepareLabelData: function (data, nameField) {
    const labelFeatures = data.features.map((feature) => {
      const centroid = this.getCentroid(feature.geometry);
      return {
        type: "Feature",
        properties: {
          name: feature.properties[nameField],
        },
        geometry: {
          type: "Point",
          coordinates: centroid,
        },
      };
    });
    return {
      type: "FeatureCollection",
      features: labelFeatures,
    };
  },
  loadShapefile: function (year) {
    const shapefileUrl = this.shapefiles[year];

    console.log(`Loading shapefile from ${shapefileUrl}`);

    fetch(shapefileUrl)
      .then((response) => response.json())
      .then((geojsonData) => {
        const nameField = this.getNameField(geojsonData);
        const labelData = this.prepareLabelData(geojsonData, nameField);

        if (this.map.getSource("us-boundaries")) {
          this.map.getSource("us-boundaries").setData(geojsonData);
          this.map.getSource("us-boundaries-labels").setData(labelData);
        } else {
          this.map.addSource("us-boundaries", {
            type: "geojson",
            data: geojsonData,
          });
          this.map.addLayer({
            id: "us-boundaries-layer",
            type: "fill",
            source: "us-boundaries",
            layout: {},
            paint: {
              "fill-color": "light grey",
              "fill-outline-color": "black",
            },
          });
          this.map.addSource("us-boundaries-labels", {
            type: "geojson",
            data: labelData,
          });
          this.map.addLayer({
            id: "us-boundaries-labels-layer",
            type: "symbol",
            source: "us-boundaries-labels",
            layout: {
              "text-field": ["get", "name"],
              "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
              "text-size": 10,
              "text-transform": "uppercase",
              "text-letter-spacing": 0.05,
              "text-offset": [0, 0.6],
              "text-anchor": "top",
            },
            paint: {
              "text-color": "black",
              "text-halo-color": "white",
              "text-halo-width": 1,
            },
          });
        }

        document.getElementById(
          "year-label-animation"
        ).textContent = `Year: ${year}`;
      })
      .catch((error) => console.error("Error loading shapefile:", error));
  },
};

animNamespace.init();
