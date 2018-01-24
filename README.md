# globe #

A high performance JavaScript library for visualizing data on a globe using WebGL and Fastlane.

### How to build the library? ###
1. Run *npm install*
2. Run *npm run build* or *npm run watch*

### Running the example ###
A more comprehensive example can be found in the public folder. There are two options to run the example

1. Run *npm start* 
2. Run *docker-compose up*

Both options start a web server on http://127.0.0.1:9999

### Setup the library ###
1. Include the public/dist/app.js and public/external/fastlane.js in your HTML document
```
#!html
<script src="dist/app.js"></script>
<script src="external/fastlane.js"></script>
```
2. Example
```
#!javascript
const container = document.getElementById("container");
const globe = new CimplexGlobeView(container, {
	basinsLoaded: globeLoaded
});

function globeLoaded() {
	// update basin values on the globe
	const data = {
		732: 1.2,
		720: 20.3
	};
	globe.updateBasinValues(data);

	// add transitions on the globe
	const transitions = [
		{
			from: 732,
			to: 720,
			weight: 1.0
		}
	];
	globe.addTransitions(transitions);

	// move camera to basin
	globe.moveCameraToBasin(720);
}
```
### API ###

* Create a new globe view instance

```
#!javascript
const globe = new CimplexGlobeView(options) 

options = {
    scaleBasins: Number,         // Scales the basin heights
    enablePostprocessing = true, // Enables/Disables postprocessing
    enableGlobe = true,          // Enables/Disables tiles on the globe
    sphericalMapping = true,     // Enables/Disables 2D/3D projection
    showStats = false,           // Draws stats (fps, triangles)
    basinsHeight = 0.04,         // Setups the maxium height of a basin
    basinsLoaded = undefined     // Callback to a function called when loading of the globe is finished
}
```

* Set basin values

```
#!javascript
	const data = {
		732: 1.2,   // pair of basin id + basin value
		720: 20.3
	};
	globe.updateBasinValues(data);
```

* Add transitions

```
#!javascript
// add transitions on the globe
	const transitions = [
		{
			from: 732,      // source basin
			to: 720,        // target basin
			weight: 1.0     // weight of the basin
		}
	];
	globe.addTransitions(transitions);
```

* Setup tile provider

```
#!javascript
// provide a callback to a custom tile provider
    globeView.urlCallback = (level, x, y) => {
        return `http://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/${level}/${y}/${x}`;
    };
```

* Load custom basins/regions

```
#!javascript
fetch("./resources/basins.geojson")
    .then(response => response.json())
    .then(data => {
		// load regions is able to parse custom geojson files
        globeView.loadRegions(data);
    });
```

## Authors

Authors of this project (comprising ideas, architecture, and code) are:

* Sebastian Alberternst <sebastian.alberternst@dfki.de>
* Jan Sutter <jan.sutter@dfki.de>

This project and code was mainly developed by:

* [DFKI](https://www.dfki.de/web/research/asr/index_html) - German Research Center for Artificial Intelligence

Parts of the project and code were developed as part of the [EU H2020](https://ec.europa.eu/programmes/horizon2020/) [project](https://www.cimplex-project.eu/) *CIMPLEX* - Bringing *CI*tizens, *M*odels and Data together in *P*articipatory, Interactive Socia*L* *EX*ploratories.

Futher partners that deliver data and simulations via webservice access are:

* ETHZ (ETH Zurich)
* UCL (University College of London)
* Közép-európai Egyetem (Central European University, CEU)
* ISI (Fondazione Istituto per l'Interscambio Scientifico)
* CNR (National Research Council)
* FBK (Bruno Kessler Foundation)
* USTUTT (University of Stuttgart, Institute for Visualization and Interactive Systems)

## Contributions

* three.js - A 3D open source [library](https://github.com/mrdoob/three.js/)
* stats.js - JavaScript Performance [Monitor](https://github.com/mrdoob/stats.js/)
* geojson-polygon-center - A simple [function](https://www.npmjs.com/package/geojson-polygon-center) that finds the central point of a GeoJSON polygon 
* geodesy - [Library](https://www.npmjs.com/package/geodesy) for various latitude/longitude calculations
* browserify -  [Organize](https://github.com/browserify/browserify) your browser code and load modules installed by npm
* earcut - The fastest and smallest JavaScript polygon triangulation [library](https://github.com/mapbox/earcut) for your WebGL apps
* watchify - [watch](https://github.com/browserify/watchify) mode for browserify builds
* serve - Static file serving and directory [listing](https://github.com/zeit/serve)
* countries.poly.geojson - geojson of all countries by [johan](https://github.com/johan/world.geo.json/tree/master/countries)
* countries.json - borders of all countries by [naturalearthdata](http://www.naturalearthdata.com/)
* src/occluder.js - occluder based on the work of [cesium](https://github.com/AnalyticalGraphicsInc/cesium)
* src/depthmaterial.js - by [zz85](https://github.com/zz85) and part of the [three.js](https://github.com/mrdoob/three.js/) examples
* src/webvr.js - WebVR extension for three.js by [mrdoob](http://mrdoob.com) & [Mugen87](https://github.com/Mugen87) and part of the [three.js](https://github.com/mrdoob/three.js/) examples
* src/vivecontroller - Support for Oculus controllers to three.js by [mrdoob](http://mrdoob.com) & [stewdio](http://stewd.io) and part of the [three.js](https://github.com/mrdoob/three.js/) examples


## License

See [LICENSE](./LICENSE).
