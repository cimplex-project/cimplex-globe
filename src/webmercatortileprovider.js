"use strict";

const utils = require("./utils");
const Rectangle = require("./rectangle");

class WebMercatorTileProvider {
    constructor(urlCallback) {
        this._numberOfZeroTilesX = 1;
        this._numberOfZeroTilesY = 1;
        this._urlCallback = urlCallback;

        const axisTimesPI = utils.equatorialRadiusMajor * Math.PI;
        this._rectangleSouthwestInMeters = {
            x: -axisTimesPI,
            y: -axisTimesPI
        };

        this._rectangleNortheastInMeters = {
            x: axisTimesPI,
            y: axisTimesPI
        }

        const southWest = utils.mercatorToWgs84(this._rectangleSouthwestInMeters.x, this._rectangleSouthwestInMeters.y);
        const northEast = utils.mercatorToWgs84(this._rectangleNortheastInMeters.x, this._rectangleNortheastInMeters.y);
        this._rectangle = new Rectangle(southWest.lon, southWest.lat, northEast.lon, northEast.lat);
    }

    getNumberOfXTilesAtLevel(level) {
        return this._numberOfZeroTilesX << level;
    }

    getNumberOfYTilesAtLevel(level) {
        return this._numberOfZeroTilesY << level;
    }

    getTile(level, x, y) {
        const xTiles = this.getNumberOfXTilesAtLevel(level);
        const yTiles = this.getNumberOfYTilesAtLevel(level);

        const xTileWidth = (this._rectangleNortheastInMeters.x - this._rectangleSouthwestInMeters.x) / xTiles;
        const west = this._rectangleSouthwestInMeters.x + x * xTileWidth;
        const east = this._rectangleSouthwestInMeters.x + (x + 1) * xTileWidth;

        const yTileHeight = (this._rectangleNortheastInMeters.y - this._rectangleSouthwestInMeters.y) / yTiles;
        const north = this._rectangleNortheastInMeters.y - y * yTileHeight;
        const south = this._rectangleNortheastInMeters.y - (y + 1) * yTileHeight;

        return new Rectangle(west, south, east, north);
    }

    getTileURL(level, x, y) {
        if (this._urlCallback) {
            return this._urlCallback(level, x, y);
        }
    }

    set urlCallback(urlCallback) {
        this._urlCallback = urlCallback;
    }

    get urlCallback() {
        return this._urlCallback;
    }
}

module.exports = WebMercatorTileProvider;
