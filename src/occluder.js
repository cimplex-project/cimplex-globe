"use strict";

const THREE = require("three");

// sphere occluder based on: 
// https://github.com/AnalyticalGraphicsInc/cesium/blob/7213d4d25e02deab085448250c5dca966f1dbfcc/Source/Core/Occluder.js

class Occluder {
    constructor() {
        this._radius = 1.0;
        this._position = new THREE.Vector3();
        this._cameraPosition = new THREE.Vector3();
    }

    _isPointVisible(point) {
        if (this._horizonDistance !== Number.MAX_VALUE) {
            var tempVec = new THREE.Vector3().subVectors(point, this._position);
            var temp = this._radius;
            temp = tempVec.lengthSq() - (temp * temp);
            if (temp > 0.0) {
                temp = Math.sqrt(temp) + this._horizonDistance;
                tempVec = new THREE.Vector3().subVectors(point, this._cameraPosition);
                return temp * temp > tempVec.lengthSq();
            }
        }
        return false;
    }

    isOccluded(samples) {
        for (let n = 0; n < samples.length; ++n) {
            if (this._isPointVisible(samples[n])) {
                return false
            }
        }
        return true;
    }

    update(cameraPosition, occluderPosition, radius) {
        this._position.copy(occluderPosition);
        this._cameraPosition.copy(cameraPosition);
        this._radius = radius;

        let cameraToOccluderVec = new THREE.Vector3().subVectors(this._position, this._cameraPosition);
        let invCameraToOccluderDistance = cameraToOccluderVec.lengthSq();
        let occluderRadiusSqrd = this._radius * this._radius;

        let horizonDistance;
        let horizonPlaneNormal;
        let horizonPlanePosition;
        if (invCameraToOccluderDistance > occluderRadiusSqrd) {
            horizonDistance = Math.sqrt(invCameraToOccluderDistance - occluderRadiusSqrd);

            invCameraToOccluderDistance = 1.0 / Math.sqrt(invCameraToOccluderDistance);
            horizonPlaneNormal = cameraToOccluderVec.clone().multiplyScalar(invCameraToOccluderDistance);
            var nearPlaneDistance = horizonDistance * horizonDistance * invCameraToOccluderDistance;
            horizonPlanePosition = new THREE.Vector3().addVectors(this._cameraPosition, horizonPlaneNormal.clone().multiplyScalar(nearPlaneDistance));
        } else {
            horizonDistance = Number.MAX_VALUE;
        }

        this._horizonDistance = horizonDistance;
        this._horizonPlaneNormal = horizonPlaneNormal;
        this._horizonPlanePosition = horizonPlanePosition;
    }

    get mesh() {
        return this._group;
    }

}

module.exports = Occluder;