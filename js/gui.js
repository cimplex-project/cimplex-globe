const gui = new dat.GUI();
const tileSources = [
    "light gray",
    "light gray(no labels)",
    "dark",
    "dark (no labels)",
    "satellite"
];

const maxRegions = 3253;

const globeObject = {
    useMap: true,
    tileSource: tileSources[0],
    basinsDataSource: "isi"
}

const transitionSettings = {
    lines: false,
    height: 1.05,
    width: 0.006,
    animate: true,
    color: [0, 0, 0],
    colorName: "black"
};

const basinsColorSettings = {
    colorTable: "oranges"
}

const simulationObject = {
    day: 0,
    autoplay: true,
    simulation: []
}

const rendering = gui.addFolder("Rendering");
rendering.add(globeView, "enablePostprocessing", true);
rendering.add(globeView, "toggleVR", true);
rendering.open();

const projection = gui.addFolder("Projection");
projection.add(globeView, "sphericalMapping");
projection.open();

const globe = gui.addFolder("Globe");
globe.add(globeView, "showGlobe");
globe.add(globeView, "showAtmosphere");
globe.add(globeView, "showBoundaries");
globe.add(globeObject, "tileSource", tileSources)
    .onChange(() => {
        const index = tileSources.indexOf(globeObject.tileSource);
        switch (index) {
            case 0:
                globeView.urlCallback = (level, x, y) => {
                    return `http://s.basemaps.cartocdn.com/light_all/${level}/${x}/${y}.png`;
                };
                break;
            case 1:
                globeView.urlCallback = (level, x, y) => {
                    return `http://s.basemaps.cartocdn.com/light_nolabels/${level}/${x}/${y}.png`;
                };
                break;
            case 2:
                globeView.urlCallback = (level, x, y) => {
                    return `http://s.basemaps.cartocdn.com/dark_all/${level}/${x}/${y}.png`;
                };
                break;
            case 3:
                globeView.urlCallback = (level, x, y) => {
                    return `http://s.basemaps.cartocdn.com/dark_nolabels/${level}/${x}/${y}.png`;
                };
                break;
            case 4:
                globeView.urlCallback = (level, x, y) => {
                    return `http://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${level}/${y}/${x}`;
                };
                break;
            default:
                globeView.urlCallback = undefined;
                break;
        }
    })
globe.add(globeObject, "basinsDataSource", ["isi", "countries"])
    .onChange(() => {
        if (globeObject.basinsDataSource === "countries") {
            fetch("./resources/countries.poly.geojson")
                .then(response => response.json())
                .then(data => {
                    globeView.loadRegions(data);
                    calculateSimulation();
                });
        } else if (globeObject.basinsDataSource === "isi") {
            fetch("./resources/basins.geojson")
                .then(response => response.json())
                .then(data => {
                    globeView.loadRegions(data);
                    calculateSimulation();
                });
        }
    });
globe.open();

const basins = gui.addFolder("Basins");
basins.add(globeView, "showBasins");
basins.add(globeView, "basinsHeight", 0.001, 1.0)
    .step(0.01);
basins.add(basinsColorSettings, "colorTable", Object.keys(colorTables))
    .onChange(value => {
        globeView.basinsColorLookup = colorTables[value];
    });
basins.open();

const transitions = gui.addFolder("Transitions");
transitions.add(globeView, "showTransitions");
transitions.add(transitionSettings, "lines")
    .onChange(() => displayDay());
transitions.add(transitionSettings, "animate")
    .onChange(() => displayDay());
transitions.add(transitionSettings, "colorName", Object.keys(transitionColors))
    .onChange(value => {
        transitionSettings.color = transitionColors[value];
        displayDay();
    });
transitions.add(transitionSettings, "height", 1.0, 2.0)
    .step(0.05)
    .onChange(() => displayDay());
transitions.add(transitionSettings, "width", 0.001, 0.10)
    .step(0.001)
    .onChange(() => displayDay());
transitions.open();

//
// Simulation
//

const simulation = gui.addFolder("Simulation");
const day = simulation.add(simulationObject, "day", 1, 365)
    .step(1)
    .onChange(value => {
       displayDay();
    })
    .listen();

simulation.add(simulationObject, "autoplay")
    .onChange(value => {
        if (value) {
            day.domElement.classList.add("disabled");
            loadDay();
        } else {
            day.domElement.classList.remove("disabled");
            if (timeoutFunction) {
                clearTimeout(timeoutFunction);
            }
        }
    });

simulation.open();

function displayDay() {
    globeView.updateBasinValues(simulationObject.simulation[simulationObject.day - 1].basins);
    globeView.clearTransitions();
    globeView.addTransitions(simulationObject.simulation[simulationObject.day - 1].transitions, transitionSettings);
}

function loadDay() {
    timeoutFunction = setTimeout(() => {
        simulationObject.day++;
        if (simulationObject.day >= 365) {
            simulationObject.day = 1;
        }
        
        displayDay();

        if (simulationObject.autoplay) {
            loadDay();
        }
    }, 10);
}

// calculates the simulation based on the current selected basins
function calculateSimulation() {
    const basinIds = [...globeView._basinManager._basins.keys()];

    simulationObject.simulation = [];
    for (let day = 0; day < 365; ++day) {
        //
        // create basin values
        //
        simulationObject.simulation[day] = {};
        simulationObject.simulation[day].basins = [];
        globeView._basinManager._basins.forEach((value, key) => {
            // calculate distance from "day" to lat
            let degreeLon = day % 360;

            // move angles to [-180:180] range
            if (degreeLon > 180) {
                degreeLon -= 360;
            }

            // calculate normalized distance to "day"
            let distanceLon = (value.center[1] - degreeLon);

            // fix range again
            if (distanceLon < 0) {
                distanceLon += 360;
            }

            simulationObject.simulation[day].basins[key] = distanceLon;
        });

        //
        // create transitions
        //

        function rand(max) {
            return Math.floor(Math.random() * (max - 1))
        }

        simulationObject.simulation[day].transitions = [];
        for (let n = 0; n < rand(100); ++n) {
            let fromId = +basinIds[rand(basinIds.length - 1)];
            let toId = +basinIds[rand(basinIds.length - 1)];
            while(fromId === toId) {
                toId = +basinIds[rand(basinIds.length - 1)];
            }

            simulationObject.simulation[day].transitions.push({
                from: fromId - 1,
                to: toId - 1,
                weight: 1.0
            })
        }
    }
}

// load isi regions on startup
fetch("./resources/basins.geojson")
    .then(response => response.json())
    .then(data => {
        globeView.loadRegions(data);
        calculateSimulation();

        if(simulationObject.autoplay) {
            day.domElement.classList.add("disabled");
            loadDay();
        }
    });