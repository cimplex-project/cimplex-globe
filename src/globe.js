"use strict";

const THREE = require("three");
const utils = require("./utils");
const Tile = require("./tile");
const Occluder = require("./occluder");
const WebMercatorTileProvider = require("./webmercatortileprovider");
const Boundaries = require("./boundaries");

const AtmoSphereShader = {
    uniforms: {},
    vertexShader: [
        "varying vec3 vNormal;",
        "void main() {", "vNormal = normalize( normalMatrix * normal );",
        "gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",
        "}"
    ].join("\n"),
    fragmentShader: [
        "varying vec3 vNormal;",
        "void main() {",
        "float intensity = pow( 1.15 - dot( vNormal, vec3( 0, 0, 1.0 ) ), 2.0 );",
        "gl_FragColor = vec4( intensity * 0.8, intensity * 0.8, intensity, intensity );",
        "}"
    ].join("\n")
}

// todo: move to occluder
class MercatorOccluder extends Occluder {
    constructor() {
        super();
    }

    isOccluded() {
        return false;
    }
};

class Globe {
    constructor(camera, {
        segments = 32,
        minZoom = 3,
        maxZoom = 5,
        sphericalMapping = true,
        tileUrlCallback = undefined
    } = {}) {
        this._camera = camera;
        this._minZoom = minZoom;
        this._maxZoom = maxZoom;
        this._zoom = this._minZoom;
        this._globeGroup = new THREE.Object3D();
        this._atomsphereGroup = new THREE.Object3D();
        this._borderGroup = new THREE.Object3D();
        this._mesh = new THREE.Object3D();
        this._mesh.add(this._borderGroup);
        this._textureLoader = new THREE.TextureLoader();
        this._mercatorTiler = new WebMercatorTileProvider(tileUrlCallback);
        this._borders = [];
        this._boundaries = new Boundaries(sphericalMapping);
        this.sphericalMapping = sphericalMapping;

        this._createRootTile();
        this._createAtmosphere();
        this._createBoundaries();
    }

    update() {
        this._calculateZoomLevel();
        this._occluder.update(this._camera.position, this._mesh.position, this._mesh.scale.x);
        this._groundTile.traverse(this._occluder, this._zoom, this._globeGroup);
        this._atmosphere.traverse(this._occluder, this._zoom, this._atomsphereGroup);
    }

    _createBoundaries() {
        this._boundaries.load("resources/countries.geojson")
            .then(mesh => {
                this._borderGroup.add(mesh);
            });
    }

    _createAtmosphere() {
        this._atmosphere = new Tile(this._mercatorTiler, 0, 0, 0, this, {
            materialFactory: tile => {
                return new THREE.ShaderMaterial({
                    uniforms: {},
                    vertexShader: AtmoSphereShader.vertexShader,
                    fragmentShader: AtmoSphereShader.fragmentShader,
                    transparent: true
                })
            },
            radius: 1.005,
            sphericalMapping: this.sphericalMapping
        });
        this._atmosphere.createMesh();
        this._mesh.add(this._atomsphereGroup);
    }

    _createRootTile() {
        this._groundTile = new Tile(this._mercatorTiler, 0, 0, 0, this, {
            sphericalMapping: this.sphericalMapping
        });
        this._mesh.add(this._globeGroup);
        this._groundTile.createMesh();

    }

    _calculateZoomLevel() {
        const v = new THREE.Vector3().subVectors(this._camera.position, this._mesh.position);
        const wgs84 = utils.cartesianToWgs84(v);
        const altitude = (wgs84.height - this._mesh.scale.x) * (utils.equatorialRadiusMajor * this._mesh.scale.x);

        this._zoom = Math.round(Math.log(35200000 * this._mesh.scale.x / altitude) / Math.log(2)) + 1;
        this._zoom = utils.clamp(this._zoom, this._minZoom, this._maxZoom);
    }

    get mesh() {
        return this._mesh;
    }

    set showAtmosphere(show) {
        this._atomsphereGroup.visible = show;
    }

    get showAtmosphere() {
        return this._atomsphereGroup.visible;
    }

    set showBoundaries(show) {
        this._borderGroup.visible = show;
    }

    get showBoundaries() {
        return this._borderGroup.visible;
    }

    set sphericalMapping(enable) {
        this._sphericalMapping = enable;

        if (this._sphericalMapping) {
            this._occluder = new Occluder();
        } else {
            this._occluder = new MercatorOccluder();
        }

        if (this._groundTile) {
            this._groundTile.sphericalMapping = this._sphericalMapping;
        }

        if (this._atmosphere) {
            this._atmosphere.sphericalMapping = this._sphericalMapping;
        }

        if (this._boundaries) {
            this._boundaries.sphericalMapping = this._sphericalMapping;
        }
    }

    get sphericalMapping() {
        return this._sphericalMapping;
    }

    get tiler() {
        return this._mercatorTiler;
    }

    get groundTile() {
        return this._groundTile;
    }

    get tileGroup() {
        return this._globeGroup;
    }
}

module.exports = Globe;