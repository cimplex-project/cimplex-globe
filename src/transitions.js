"use strict";

const THREE = require("three");

class Transitions {
    constructor(transitions, {
        animate = true,
        height = 1.05,
        width = 0.006,
        sphericalMapping = true,
        maxValue = 1.0,
        color = [0, 0, 0]
    } = {}) {
        this._animate = animate;
        this._height = height;
        this._width = width;
        this._maxSegments = 30;
        this._mesh = new THREE.Object3D();
        this._transitions = transitions;
        this._sphericalMapping = sphericalMapping;
        this._maxValue = maxValue;
        this._color = new THREE.Vector3().fromArray(color);
        this.build();
    }

    build() {
        throw TypeError("must override method");
    }

    update() {
        throw TypeError("must override method");
    }

    updateSphericalMapping() {
        this.dispose();
        this.build();
    }

    dispose() {
        throw TypeError("must override method");
    }

    get mesh() {
        return this._mesh;
    }

    set sphericalMapping(enable) {
        if (this._sphericalMapping !== enable) {
            this._sphericalMapping = enable;
            this.updateSphericalMapping();
        }
    }

    get sphericalMapping() {
        return this._sphericalMapping;
    }
}

module.exports = Transitions;
