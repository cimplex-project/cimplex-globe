"use strict";

const THREE = require("three");
const LatLon = require("geodesy").LatLonSpherical;
const utils = require("./utils");

class Curve {
    constructor(positions) {
        this._positions = positions;
    }

    static createCurve(sourceBasin, destinationBasin, {
        sphericalMapping = true,
        height = 1.05,
        sampleCount = 100
    } = {}) {
        const start = new LatLon(sourceBasin.center[0], sourceBasin.center[1]);
        const end = new LatLon(destinationBasin.center[0], destinationBasin.center[1]);
        const coordinates = [];
        const heightFromGround = height - 1.0;
        const damping = start.distanceTo(end) / (utils.equatorialRadiusMajor / 2);

        for (let n = 0; n < sampleCount; ++n) {
            let intermediatePoint = null;
            if (sphericalMapping) {
                intermediatePoint = start.intermediatePointTo(end, n / (sampleCount - 1));
            } else {
                intermediatePoint = {
                    lat: start.lat + (end.lat - start.lat) * n / (sampleCount - 1),
                    lon: start.lon + (end.lon - start.lon) * n / (sampleCount - 1)
                }
            }
            const calculatedHeight = sourceBasin.height + (destinationBasin.height - sourceBasin.height) * (n / (sampleCount - 1));
            const arc = heightFromGround * Math.sin(n * (Math.PI / (sampleCount - 1))) * damping;
            coordinates.push(new THREE.Vector3().fromArray(utils.mapWgs84(sphericalMapping, intermediatePoint.lat, intermediatePoint.lon, calculatedHeight + 1.0 + arc)));
        }

        return new Curve(coordinates);
    }

    getPosition(n) {
        if (n >= this._positions.length) {
            throw Error(`${n} out of bounds`);
        }

        return this._positions[n];
    }

    getTangent(n) {
        if (n >= this._positions.length) {
            throw Error(`${n} out of bounds`);
        }

        if (n < this._positions.length - 1) {
            return new THREE.Vector3().subVectors(this._positions[n], this._positions[n + 1]).normalize();
        }
        return new THREE.Vector3().subVectors(this._positions[n - 1], this._positions[n]).normalize();
    }

    get length() {
        return this._positions.length;
    }

}

module.exports = Curve;
