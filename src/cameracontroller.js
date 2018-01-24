"use strict";

const THREE = require("three");
const utils = require("./utils");

const Status = {
    None: 0,
    Rotate: 1,
    Zoom: 2,
    Pan: 3
};

function calculateOffsetTouch(touch) {
    const rect = touch.target.getBoundingClientRect();
    const x = touch.pageX - rect.left;
    const y = touch.pageY - rect.top;
    return new THREE.Vector2(x, y);
}

class CameraController {
    constructor(renderer, camera, globe, sphericalMapping, minDistance = 1.02, maxDistance = 5.00) {
        this._renderer = renderer;
        this._globe = globe;
        this._camera = camera;
        this._target = new THREE.Vector3(0, 0, 0);
        this._north = new THREE.Vector3(0, 1.0, 0);
        this._south = new THREE.Vector3(0, -1.0, 0);
        this._sphericalDelta = new THREE.Spherical();
        this._rayCaster = new THREE.Raycaster();
        this._cameraPosition = new THREE.Vector3();
        this._scaledCameraPosition = new THREE.Vector3();
        this._startPosition = new THREE.Spherical();
        this._panOffset = new THREE.Vector3();
        this._lastLength = -1;
        this._status = Status.None;
        this._minDistance = minDistance;
        this._maxDistance = maxDistance;
        this._zoomSpeed = 0.3;
        this._sphericalMapping = sphericalMapping;
        if (this._sphericalMapping) {
            this._spherical = new THREE.Spherical(2, Math.PI / 2, 0);
        } else {
            this._spherical = new THREE.Spherical(4, Math.PI / 2, 0);
        }

        this._renderer.domElement.addEventListener("contextmenu", this._onContextMenu.bind(this), false);
        this._renderer.domElement.addEventListener("mousedown", this._onMouseDown.bind(this), false);
        this._renderer.domElement.addEventListener("mousemove", this._onMouseMove.bind(this), false);
        document.addEventListener("mouseup", this._onMouseUp.bind(this), false);
        this._renderer.domElement.addEventListener("wheel", this._onMouseWheel.bind(this), false);
        this._renderer.domElement.addEventListener("touchstart", this._onTouchStart.bind(this), false);
        this._renderer.domElement.addEventListener("touchend", this._onTouchEnd.bind(this), false);
        this._renderer.domElement.addEventListener("touchmove", this._onTouchMove.bind(this), false);
    }

    update() {
        this._target.add(this._panOffset);

        if (this._sphericalMapping) {
            this._spherical.setFromVector3(this._camera.position);

            this._spherical.radius -= (this._sphericalDelta.radius * ((this._spherical.radius - 1) / (this._maxDistance - 1)));
            this._spherical.theta -= this._sphericalDelta.theta;
            this._spherical.phi -= this._sphericalDelta.phi;

            this._spherical.radius = utils.clamp(this._spherical.radius, this._minDistance, this._maxDistance);
            this._spherical.phi = utils.clamp(this._spherical.phi, 0.1, Math.PI - 0.1);

            this._cameraPosition.setFromSpherical(this._spherical);
            this._camera.position.copy(this._cameraPosition);
        } else {
            const distance = this._sphericalDelta.radius * this._spherical.radius / this._maxDistance * 0.5;
            this._camera.position.add(this._panOffset);
            this._camera.position.z -= distance;
            this._camera.position.z = utils.clamp(this._camera.position.z, this._minDistance, this._maxDistance);
        }

        this._camera.lookAt(this._target);
        this._sphericalDelta.set(0, 0, 0);
        this._panOffset.set(0, 0, 0);
    }

    reset() {
        this._target = new THREE.Vector3(0, 0, 0);
        if (this._sphericalMapping) {
            this._spherical = new THREE.Spherical(2, Math.PI / 2, 0);
        } else {
            this._spherical = new THREE.Spherical(4, Math.PI / 2, 0);
        }
        this._cameraPosition.setFromSpherical(this._spherical);
        this._camera.position.copy(this._cameraPosition);
    }

    set sphericalMapping(sphericalMapping) {
        if (this._sphericalMapping !== sphericalMapping) {
            this._sphericalMapping = sphericalMapping;

            if (!this._sphericalMapping) {
                this._camera.position.set(0, 0, this._spherical.radius);
                this._target.set(0, 0, 1);
                this._cameraPosition.copy(this._target);
                this._cameraPosition.z = this._spherical.radius
            } else {
                this._target.set(0, 0, 0);
            }
        }
    }

    set target(target) {
        this._target = target;
    }

    _calculateMouseNDC(mouse) {
        const ndcMouse = mouse.clone();
        ndcMouse.x = mouse.x / this._renderer.getSize()
            .width * 2 - 1;
        ndcMouse.y = -mouse.y / this._renderer.getSize()
            .height * 2 + 1;
        return ndcMouse;
    }

    _intersectGlobe(mouse) {
        this._rayCaster.setFromCamera(this._calculateMouseNDC(mouse), this._camera);
        const intersections = this._rayCaster.intersectObject(this._globe.tileGroup, true);
        if (intersections[0]) {
            return intersections[0].point;
        }
    }

    _onTouchStart(event) {
        switch (event.touches.length) {
            case 1:
                const touch = calculateOffsetTouch(event.touches[0]);
                const point = this._intersectGlobe(touch);
                if (point) {
                    this._startPosition = new THREE.Spherical()
                        .setFromVector3(point);
                    if (this._sphericalMapping) {
                        this._status = Status.Rotate;
                    } else {
                        this._status = Status.Pan;
                    }
                }
                break;

            case 2:
                const touch1 = calculateOffsetTouch(event.touches[0]);
                const touch2 = calculateOffsetTouch(event.touches[1]);
                this._lastLength = touch1.sub(touch2)
                    .length();
                this._status = Status.Zoom;
                break;
        }
        event.preventDefault();
    }

    _onTouchMove(event) {
        switch (this._status) {
            case Status.Rotate:
                const touch = calculateOffsetTouch(event.touches[0]);
                const point = this._intersectGlobe(touch);

                if (point) {
                    this._currentPosition = new THREE.Spherical()
                        .setFromVector3(point);
                    this._sphericalDelta.phi = this._currentPosition.phi - this._startPosition.phi;
                    this._sphericalDelta.theta = this._currentPosition.theta - this._startPosition.theta;
                }
                break;

            case Status.Zoom:
                const touch1 = calculateOffsetTouch(event.touches[0]); //new THREE.Vector2(event.touches[0].clientX, event.touches[0].clientY);
                const touch2 = calculateOffsetTouch(event.touches[1]); //new THREE.Vector2(event.touches[1].clientX, event.touches[1].clientY);
                const length = touch1.sub(touch2)
                    .length();

                if (length > this._lastLength) {
                    this._sphericalDelta.radius = this._zoomSpeed;
                } else {
                    this._sphericalDelta.radius = -this._zoomSpeed;
                }

                this._lastLength = length;
                break;

            case Status.Pan:
                {
                    const touch = calculateOffsetTouch(event.touches[0]);
                    const point = this._intersectGlobe(touch);
                    if (point) {
                        const currentPosition = point.clone();
                        const startVector = new THREE.Vector3()
                            .setFromSpherical(this._startPosition);

                        currentPosition.sub(startVector);

                        this._panOffset.x = -currentPosition.x;
                        this._panOffset.y = -currentPosition.y;
                        this._panOffset.z = 0;
                    }
                }
                break;
        }
        event.preventDefault();
    }

    _onTouchEnd() {
        this._status = Status.None;
    }

    _onContextMenu(event) {
        event.preventDefault();
    }

    _onMouseDown(event) {
        const mouse = new THREE.Vector2(event.offsetX, event.offsetY);
        const point = this._intersectGlobe(mouse);
        if (point) {
            this._startPosition = new THREE.Spherical()
                .setFromVector3(point);

            switch (event.button) {
                case 0:
                    {
                        if (this._sphericalMapping) {
                            this._status = Status.Rotate;
                        } else {
                            this._status = Status.Pan;
                        }
                    }
                    break;

                case 2:
                    {
                        if (this._sphericalMapping) {
                            this._status = Status.Pan;
                        }
                    }
                    break;
            }
        }
        event.preventDefault();
    }

    _onMouseMove(event) {
        const mouse = new THREE.Vector2(event.offsetX, event.offsetY);
        switch (this._status) {
            case Status.Rotate:
                {
                    const point = this._intersectGlobe(mouse);
                    if (point) {
                        const currentPosition = new THREE.Spherical()
                            .setFromVector3(point);
                        this._sphericalDelta.phi = currentPosition.phi - this._startPosition.phi;
                        this._sphericalDelta.theta = currentPosition.theta - this._startPosition.theta;
                    }
                }
                break;

            case Status.Pan:
                {
                    const point = this._intersectGlobe(mouse);
                    if (point) {
                        const currentPosition = point.clone();
                        const startVector = new THREE.Vector3()
                            .setFromSpherical(this._startPosition);

                        currentPosition.sub(startVector);

                        this._panOffset.x = -currentPosition.x;
                        this._panOffset.y = -currentPosition.y;
                        this._panOffset.z = 0;
                    }
                }
                break;
        }
        event.preventDefault();
    }

    _onMouseUp(event) {
        this._status = Status.None;
    }

    _onMouseWheel(event) {
        const mouse = new THREE.Vector2(event.offsetX, event.offsetY);
        const point = this._intersectGlobe(mouse);

        if (point) {
            if (event.deltaY < 0) {
                this._sphericalDelta.radius = this._zoomSpeed;
            } else if (event.deltaY > 0) {
                this._sphericalDelta.radius = -this._zoomSpeed;
            }
        }

        event.preventDefault();
        event.stopPropagation();
    }
}

module.exports = CameraController;