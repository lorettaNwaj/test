document.addEventListener("DOMContentLoaded", function () {
  console.log("DOMContentLoaded event fired for density.js");

  const loader = document.getElementById("loader");
  const tooltip = d3.select("#tooltip");

  const densityNamespace = {
    mapboxToken:
      "pk.eyJ1Ijoibndhamlha3UiLCJhIjoiY2x3amphbXZ2MG02YTJscDRmcXE3MDllZCJ9.RwnwQjJ1U0Y95kTvA-4i7g",
    shapefiles: {
      1800: "geojson/harvard-nhgis-pop1800-geojson.json",
      1810: "geojson/harvard-nhgis-pop1810-geojson.json",
      1820: "geojson/harvard-nhgis-pop1820-geojson.json",
      1830: "geojson/harvard-nhgis-pop1830-geojson.json",
      1840: "geojson/harvard-nhgis-pop1840-geojson.json",
      1850: "geojson/harvard-nhgis-pop1850-geojson.json",
      1860: "geojson/harvard-nhgis-pop1860-geojson.json",
      1870: "geojson/harvard-nhgis-pop1870-geojson.json",
      1880: "geojson/harvard-nhgis-pop1880-geojson.json",
      1890: "geojson/harvard-nhgis-pop1890-geojson.json",
      1900: "geojson/harvard-nhgis-pop1900-geojson.json",
    },
    init: function () {
      console.log("Initializing densityNamespace");

      mapboxgl.accessToken = this.mapboxToken;

      this.map = new mapboxgl.Map({
        container: "mapDen",
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
        this.loadMapData(1800);
      });

      const slider = document.getElementById("slider-density");
      const yearLabel = document.getElementById("year-label-density");

      slider.addEventListener("input", (e) => {
        const year = e.target.value;
        yearLabel.textContent = `Year: ${year}`;
        console.log(`Slider input changed, loading data for year: ${year}`);
        this.loadMapData(year);
      });
    },
    getNameField: function (data) {
      const possibleFields = ["ICPSRNAM", "NHGISNAM"];
      const properties = data.features[0].properties;
      for (let field of possibleFields) {
        if (properties.hasOwnProperty(field)) {
          console.log(`Using field: ${field}`); // Debugging statement
          return field;
        }
      }
      console.log("No matching field found"); // Debugging statement
      return null; // If neither field is found, return null
    },
    getCentroid: function (geometry) {
      if (geometry.type === "Polygon") {
        return turf.centroid(geometry).geometry.coordinates;
      } else if (geometry.type === "MultiPolygon") {
        let largestPolygon = geometry.coordinates.reduce((a, b) => {
          return turf.area(turf.polygon(a)) > turf.area(turf.polygon(b))
            ? a
            : b;
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
    calculatePopulationDensity: function (data) {
      data.features.forEach((feature) => {
        const popTotal = feature.properties.POP_TOTAL;
        const areaSqm = feature.properties.AREA_SQM;

        const areaSqkm = areaSqm / 1000000;

        console.log(
          `Feature: ${
            feature.properties[this.getNameField(data)]
          }, POP_TOTAL: ${popTotal}, AREA_SQKM: ${areaSqkm}`
        );

        if (popTotal && areaSqkm && areaSqkm > 0) {
          feature.properties.popDensity = popTotal / areaSqkm;
        } else {
          feature.properties.popDensity = 0;
          console.log(
            `Invalid data for ${feature.properties[this.getNameField(data)]}`
          );
        }
      });
    },
    getColorScale: function (densities, numClasses) {
      const scale = d3
        .scaleQuantile()
        .domain(densities)
        .range(colorbrewer.Blues[numClasses]);
      const thresholds = scale.quantiles();

      return {
        scale: (value) => scale(value),
        thresholds: thresholds,
      };
    },
    loadMapData: function (year) {
      const url = this.shapefiles[year];
      console.log(`Fetching data for year: ${year} from ${url}`);

      d3.json(url)
        .then((data) => {
          console.log(`Data fetched for year: ${year}`, data);

          const nameField = this.getNameField(data);
          if (!nameField) {
            console.error("No name field found in the data.");
            return;
          }

          this.calculatePopulationDensity(data);

          const densities = data.features.map(
            (feature) => feature.properties.popDensity
          );

          const colorInfo = this.getColorScale(densities, 5);

          data.features.forEach((feature) => {
            feature.properties.color = colorInfo.scale(
              feature.properties.popDensity
            );
          });

          const labelData = this.prepareLabelData(data, nameField);

          if (this.map.getSource("polygons")) {
            this.map.getSource("polygons").setData(data);
          } else {
            this.map.addSource("polygons", {
              type: "geojson",
              data: data,
            });
            this.map.addLayer({
              id: "polygon-layer",
              type: "fill",
              source: "polygons",
              paint: {
                "fill-color": ["get", "color"],
                "fill-opacity": 0.5,
                "fill-outline-color": "black",
              },
            });

            this.map.on("mousemove", "polygon-layer", (e) => {
              if (e.features.length > 0) {
                const feature = e.features[0];
                const popDensity = feature.properties.popDensity.toFixed(2);
                const name = feature.properties.NHGISNAM;

                console.log(
                  `Feature: ${name}, Population Density: ${popDensity}`
                );
                tooltip
                  .style("opacity", 1)
                  .html(
                    `${name} has a population density of ${popDensity} per sqkm`
                  )
                  .style("left", `${e.originalEvent.pageX + 10}px`)
                  .style("top", `${e.originalEvent.pageY + 10}px`);
              }
            });

            this.map.on("mouseleave", "polygon-layer", () => {
              tooltip.style("opacity", 0);
            });
          }

          if (this.map.getSource("labels")) {
            this.map.getSource("labels").setData(labelData);
          } else {
            this.map.addSource("labels", {
              type: "geojson",
              data: labelData,
            });
            this.map.addLayer({
              id: "us-boundaries-labels-layer",
              type: "symbol",
              source: "labels",
              layout: {
                "text-field": ["get", "name"],
                "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
                "text-size": 5,
                "text-transform": "lowercase",
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

          loader.style.display = "none";
        })
        .catch((error) => {
          console.error("Error fetching data:", error);
        });
    },
  };

  densityNamespace.init();
});
