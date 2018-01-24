const THREE = require("three");
const utils = require("./utils");
const Globe = require("./globe");
const BasinLoader = require("./basin_loader");
const BasinManager = require("./basin_manager");
const Picker = require("./picker");
const SobelPass = require("./sobelpass");
const Transitions = require("./transitions");
const LinesTransitions = require("./linestransitions");
const PolylineTransitions = require("./polylinetransitions");
const CameraController = require("./cameracontroller");
const Stats = require("stats.js");
const WebVR = require("./webvr");
const ViveController = require("./vivecontroller");

class ThreeApp {
    constructor(container, {
        scaleBasins = 0.1,
        enablePostprocessing = true,
        enableGlobe = true,
        enableCameraControls = true,
        sphericalMapping = true,
        showStats = false,
        basinsHeight = 0.04,
        basinsLoaded = undefined,
        enableVR = true,
        tileUrlCallback = undefined
    } = {}) {
        this._enableRendering = true;
        this._enableVR = enableVR;
        this._activeVR = false;
        this._container = container;
        this._resolution = new THREE.Vector2(this._container.clientWidth, this._container.clientHeight);
        this._renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true 
        });
        this._renderer.autoClearColor = false;
        this._renderer.autoClearDepth = false;
        this._renderer.autoClearStencil = false;
        this._renderer.setClearColor(0xFFFFFF, 0);
        this._camera = new THREE.PerspectiveCamera(45, this._resolution.x / this._resolution.y, 0.001, 10);
        this._scene = new THREE.Scene();
        this._textureLoader = new THREE.TextureLoader();
        this._scene.add(this._camera);
        this._renderer.setSize(this._resolution.x, this._resolution.y);

        this._container.appendChild(this._renderer.domElement);
        this._camera.position.set(0, 0, 4);
        this._camera.lookAt(new THREE.Vector3(0, 0, 0));
        this._sobelPass = new SobelPass(this._renderer);
        this._enablePostprocessing = enablePostprocessing;
        this._transitions = new Map();
        this._transitionId = 0;
        this._stats = new Stats();
        this._sphericalMapping = sphericalMapping;
        this._basinsLoaded = basinsLoaded;

        if (showStats) {
            this._container.appendChild(this._stats.dom);
            this._stats.showPanel(0);
        }

        this._setupBasins(scaleBasins, basinsHeight);
        this._setupGlobe(enableGlobe, tileUrlCallback);
        this._setupPicking();
        this._setupVR();

        this._transitionsGroup = new THREE.Object3D();
        this._globe.mesh.add(this._transitionsGroup);

        this._cameraController = new CameraController(this._renderer, this._camera, this._globe, this._sphericalMapping);
        this._renderer.animate(this._render.bind(this));
    }

    _setupVR() {
        if (this._enableVR) {
            this._enableVRScaling = false;
            this._vrScalingFactor = 1.0;
            WebVR.getVRDisplay((display) => {
                this._renderer.vr.setDevice(display);
            });
            this._controller1 = new THREE.ViveController(0);
            this._controller1.standingMatrix = this._renderer.vr.getStandingMatrix();
            this._controller1.addEventListener('triggerdown', this._onTriggerDown.bind(this));
            this._controller1.addEventListener('triggerup', this._onTriggerUp.bind(this));
            this._scene.add(this._controller1);
            this._controller2 = new THREE.ViveController(1);
            this._controller2.standingMatrix = this._renderer.vr.getStandingMatrix();
            this._controller2.addEventListener("triggerdown", this._onTriggerDown.bind(this));
            this._controller2.addEventListener("triggerup", this._onTriggerUp.bind(this));
            this._controller2.addEventListener("gripsup", this._onGripsUp.bind(this));
            this._scene.add(this._controller2);
        }
    }

    _setupBasins(scaleBasins, basinsHeight) {
        this._basinManager = new BasinManager({
            sphericalMapping: this._sphericalMapping,
            basinsHeight
        });
        this._basinLoader = new BasinLoader(this._basinManager, scaleBasins);
    }

    _setupGlobe(enableGlobe, tileUrlCallback) {
        this._globe = new Globe(this._camera, {
            sphericalMapping: this._sphericalMapping,
            tileUrlCallback
        });
        this._globe.mesh.visible = enableGlobe;
        this._scene.add(this._globe.mesh);
    }

    _setupPicking() {
        this._objectPicker = new Picker(this._renderer.getSize(), this._basinManager);
        this._highlightMaterial = new THREE.MeshBasicMaterial({
            side: THREE.DoubleSide,
            polygonOffset: true,
            polygonOffsetFactor: -1.0,
            polygonOffsetUnits: -4.0,
            color: 0xFFFF00
        });

        this._mouse = new THREE.Vector2();
        this._renderer.domElement.onmousemove = e => {
            this._mouse.x = e.offsetX;
            this._mouse.y = e.offsetY;

            // this can either be a basin or a scene object
            // and we have to differentiate between them
            // todo: try to make the unify the result from pick to avoid this or at least implement an object highlighter
            this._pickedObject = this._objectPicker.pick(this._mouse);
            if (this._pickedObject) {
                if (this._highlightedMesh) {
                    this._scene.remove(this._highlightedMesh);
                    this._highlightedMesh.geometry.dispose();
                }
                if (this._pickedObject.geometry) {
                    this._highlightedMesh = new THREE.Mesh(this._pickedObject.geometry, this._highlightMaterial);
                } else {
                    this._highlightedMesh = this._pickedObject.object.clone();
                    this._highlightedMesh.material = this._highlightMaterial;
                }

                const event = new CustomEvent("basin-picked", {
                    detail: parseInt(this._pickedObject.id - 1)
                });;
                this._container.dispatchEvent(event);

                this._scene.add(this._highlightedMesh)
            } else {
                if (this._highlightedMesh) {
                    this._scene.remove(this._highlightedMesh);
                    this._highlightedMesh.geometry.dispose();

                    const event = new CustomEvent("basin-released");
                    this._container.dispatchEvent(event);
                }
            }
        };
    }

    _render() {
        if (!this._enableRendering) {
            return;
        }

        this._stats.begin();

        if (this._activeVR) {
            this._updateVR();
        } else {
            this._cameraController.update();
        }

        this._renderer.clearTarget(undefined, true, true, true);
        this._renderer.render(this._scene, this._camera);

        if (this._enablePostprocessing && !this._activeVR) {
            const showAtmosphere = this._globe.showAtmosphere;
            this._globe.showAtmosphere = false;
            this._sobelPass.render(this._scene, this._camera);
            if (this._sphericalMapping) {
                this._globe.showAtmosphere = showAtmosphere;
            }
        }

        this._objectPicker.update(this._renderer, this._scene, this._camera, [this._highlightedMesh, this._transitionsGroup]);
        this._globe.update();

        for (let transition of this._transitions.values()) {
            transition.update();
        }

        this._stats.end();
    }

    _updateVR() {
        this._controller1.update();
        this._controller2.update();

        if (this._isVRScaling) {
            const distance = this._controller2.position.distanceTo(this._controller1.position);
            this._vrScalingFactor += (distance - this._lastVRScalingFactor);
            if (this._vrScalingFactor < 0.1) {
                this._vrScalingFactor = 0.1;
            }
            this._globe.mesh.scale.set(this._vrScalingFactor, this._vrScalingFactor, this._vrScalingFactor);
            this._lastVRScalingFactor = distance;
        } else if (this._isVRTranslating) {
            const pose = this._controller2.getGamepad().pose;
            if (pose && pose.position && pose.orientation) {
                const currentPosition = this._controller2.position.clone();
                const dPosition = new THREE.Vector3().subVectors(this._gamepad2LastPosition, currentPosition);
                this._globe.mesh.position.sub(dPosition);
                this._gamepad2LastPosition = currentPosition;

                const gamepad2CurrentOrientation = this._controller2.quaternion.clone();
                const gamepad2LastOrientationInverse = this._gamepad2LastOrientation.clone().premultiply(this._globe.mesh.quaternion.clone().inverse());
                gamepad2LastOrientationInverse.inverse().premultiply(this._controller2.quaternion);
                this._globe.mesh.quaternion.copy(gamepad2LastOrientationInverse);
                this._gamepad2LastOrientation = gamepad2CurrentOrientation.clone();
            }
        }
    }

    _getBasinCenter(id) {
        const basin = this._basinManager.getBasin(id);
        if (basin) {
            return basin.center;
        }
    }

    _filterTransitions(transitions) {
        const filteredTransitions = [];
        let maxValue = Number.MIN_VALUE;
        transitions.forEach(transition => {
            if (transition.weight === undefined) {
                transition.weight = 1.0;
            }
            maxValue = Math.max(maxValue, transition.weight);
            filteredTransitions.push({
                from: this._basinManager.getBasin(transition.from + 1),
                to: this._basinManager.getBasin(transition.to + 1),
                weight: transition.weight
            });
        });
        return {
            filteredTransitions,
            maxValue
        };
    }

    _onTriggerDown(event) {
        if (this._controller2.getButtonState("trigger") && this._controller1.getButtonState("trigger")) {
            this._isVRTranslating = false;
            this._isVRScaling = true;
            this._lastVRScalingFactor = this._controller2.position.distanceTo(this._controller1.position);;
        } else if (event.target === this._controller2) {
            const pose = this._controller2.getGamepad().pose;
            if (pose && pose.position && pose.orientation) {
                this._isVRTranslating = true;
                this._gamepad2LastPosition = this._controller2.position.clone();
                this._gamepad2LastOrientation = this._controller2.quaternion.clone();
            }
        }
    }

    _onTriggerUp(event) {
        this._isVRScaling = false;
        if (event.target === this._controller2) {
            this._isVRTranslating = false;
        }
    }

    _onGripsUp(event) {
        const pose = this._controller2.getGamepad().pose;
        if (this._controller1.getButtonState("grips")) {
            if (pose && pose.position && pose.orientation) {
                this._globe.mesh.position.copy(this._controller2.position);
                this._globe.mesh.quaternion.copy(this._controller2.quaternion);
                this._vrScalingFactor = 0.2;
                this._globe.mesh.scale.set(this._vrScalingFactor, this._vrScalingFactor, this._vrScalingFactor);
            }
        }
    }

    toggleVR() {
        if (this._enableVR && this._renderer.vr.getDevice()) {
            this._activeVR = !this._activeVR;
            this._renderer.vr.enabled = this._activeVR;
            if (this._activeVR) {
                this._storedSize = this._renderer.getSize();
                this._renderer.vr.getDevice().requestPresent([{
                    source: this._renderer.domElement
                }]);
            } else {
                this._renderer.vr.getDevice().exitPresent();
                this.resize(this._storedSize.width, this._storedSize.height);
                this._globe.mesh.position.set(0, 0, 0);
                this._globe.mesh.scale.set(1, 1, 1);
                this._globe.mesh.rotation.set(0, 0, 0);
                this._cameraController.reset();
            }
        }
    }

    loadRegions(data, options) {
        if (this._basinLoader) {
            this._scene.remove(this._basinManager.mesh);
            this._basinManager.mesh.geometry.dispose();
            this._basinManager.mesh.material.dispose();
        }

        this._basinManager.reset();
        this._basinLoader.load(data, options)
        this._globe.mesh.add(this._basinManager.mesh);
        if (this._basinsLoaded) {
            this._basinsLoaded();
        }
    }

    addTransitions(transitions, {
        height = 1.05,
        lines = false,
        animate = true,
        width = 0.006,
        color = [0, 0, 0]
    } = {}) {
        if (transitions.length === 0) {
            return;
        }
        const transitionType = lines ?
            LinesTransitions :
            PolylineTransitions;
        const {
            filteredTransitions,
            maxValue
        } = this._filterTransitions(transitions);
        const createdTransitions = new transitionType(filteredTransitions, {
            animate,
            height,
            width,
            sphericalMapping: this._sphericalMapping,
            maxValue,
            color
        });
        this._transitions.set(this._transitionId++, createdTransitions);
        this._transitionsGroup.add(createdTransitions.mesh);

        return this._transitionId - 1;
    }

    hideTransitionsById(id) {
        if (this._transitions.has(id)) {
            this._transitions.get(id).mesh.visible = false;
        }
    }

    showTransitionsById(id) {
        if (this._transitions.has(id)) {
            this._transitions.get(id).mesh.visible = true;
        }
    }

    removeTransitionsById(id) {
        if (this._transitions.has(id)) {
            const transition = this._transitions.get(id);
            this._transitionsGroup.remove(transition.mesh);

            transition.dispose();
            this._transitions.delete(id);
        }
    }

    clearTransitions() {
        for (let transition of this._transitions.values()) {
            this._transitionsGroup.remove(transition.mesh);
            transition.dispose();
        }
        this._transitions.clear();
    }

    resize(width, height) {
        this._camera.aspect = width / height;
        this._camera.updateProjectionMatrix();

        this._renderer.setSize(width, height);
    }

    updateBasinValues(values, colors) {
        this._basinManager.updateBasinValues(values, colors);
    }

    moveCamera(lat, lon, height) {
        const sphericalPosition = utils.mapWgs84(this._sphericalMapping, lat, lon, Math.max(1.0, height));
        this._camera.position.set(sphericalPosition[0], sphericalPosition[1], sphericalPosition[2]);
        if (!this._sphericalMapping) {
            this._cameraController.target = new THREE.Vector3(sphericalPosition[0], sphericalPosition[1], 0);
        }
    }

    moveCameraToBasin(id, height = 2.0) {
        const basinInfo = this._basinManager.getBasin(id + 1);
        if (basinInfo) {
            this.moveCamera(basinInfo.center[0], basinInfo.center[1], height);
        }
    }

    resetCamera() {
        this._cameraController.reset();
    }

    set enablePostprocessing(enable) {
        this._enablePostprocessing = enable;
    }

    get enablePostprocessing() {
        return this._enablePostprocessing;
    }

    set showBoundaries(show) {
        this._globe.showBoundaries = show;
    }

    get showBoundaries() {
        return this._globe.showBoundaries;
    }

    set showGlobe(show) {
        this._globe.mesh.visible = show;
    }

    get showGlobe() {
        return this._globe.mesh.visible;
    }

    set showAtmosphere(show) {
        this._globe.showAtmosphere = show;
    }

    get showAtmosphere() {
        return this._globe.showAtmosphere;
    }

    set showTransitions(show) {
        this._transitionsGroup.visible = show;
    }

    get showTransitions() {
        return this._transitionsGroup.visible;
    }

    set showBasins(show) {
        this._basinManager.mesh.visible = show;
    }

    get showBasins() {
        return this._basinManager.mesh.visible;
    }

    set basinsHeight(height) {
        this._basinManager.scaleHeight = height;
    }

    get basinsHeight() {
        return this._basinManager.scaleHeight;
    }

    set sphericalMapping(enable) {
        if (this._sphericalMapping != enable) {
            this._sphericalMapping = enable;
            this._basinManager.sphericalMapping = this._sphericalMapping;
            this._globe.sphericalMapping = this._sphericalMapping;
            this._cameraController.sphericalMapping = this._sphericalMapping;

            for (let transition of this._transitions.values()) {
                transition.sphericalMapping = this._sphericalMapping;
            }
        }
    }

    get sphericalMapping() {
        return this._sphericalMapping;
    }

    set render(enable) {
        this._enableRendering = enable;
        if (this._enableRendering) {
            requestAnimationFrame(this._render.bind(this));
        }
    }

    get render() {
        return this._enableRendering;
    }

    set urlCallback(urlCallback) {
        this._globe.tiler.urlCallback = urlCallback;
        this._globe.groundTile.refetchTiles();
    }

    set basinsColorLookup(colorLookup) {
        this._basinManager.colorLookup = colorLookup;
    }
}

exports = module.exports = ThreeApp;