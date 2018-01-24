"use strict";

const THREE = require("three");
const utils = require("./utils");


function generateSample(x, y) {
    return new THREE.Vector3().fromArray(utils.mercatorToSpherical({
        x: x,
        y: y
    })).multiplyScalar(1.001);
}

class Rectangle {
    constructor(west, south, east, north) {
        this._west = west;
        this._south = south;
        this._east = east;
        this._north = north;

        let tmp = this._east - this._west;
        this._width = Math.sqrt(tmp * tmp);

        tmp = this._south - this._north;
        this._height = Math.sqrt(tmp * tmp);
    }

    computeBoundigBox() {
        const wgsMin = utils.mercatorToWgs84({
            x: this.west,
            y: this.north
        });
        const wgsMax = utils.mercatorToWgs84({
            x: this.east,
            y: this.south
        });

        return new THREE.Box3(new THREE.Vector3().fromArray(utils.wgs84toSpherical(wgsMin.lat, wgsMin.lon)), new THREE.Vector3().fromArray(utils.wgs84toSpherical(wgsMax.lat, wgsMax.lon)));
    }

    computeMercatorBoundingBox() {
        return new THREE.Box2(new THREE.Vector2(this.west, this.north), new THREE.Vector2(this.east, this.south));
    }

    sample() {
        const samples = [];

        samples.push(generateSample(this.west, this.north));
        samples.push(generateSample(this.east, this.north));
        samples.push(generateSample(this.west, this.south));
        samples.push(generateSample(this.east, this.south));

        let y = 0.0;
        if (this.north < 0) {
            y = this.north;
        } else if (this.south > 0.0) {
            y = this.south;
        }

        const widthSegment = this.width / 8;
        for (let n = 0; n < 8; ++n) {
            samples.push(generateSample(this.west + n * widthSegment, y));
        }

        if (y === 0) {
            samples.push(generateSample(this.east, 0));
            samples.push(generateSample(this.westwest, 0));
        }
        return samples;
    }

    get height() {
        return this._height;
    }

    get width() {
        return this._width;
    }

    get west() {
        return this._west;
    }

    get south() {
        return this._south;
    }

    get east() {
        return this._east;
    }

    get north() {
        return this._north;
    }
}

module.exports = Rectangle;