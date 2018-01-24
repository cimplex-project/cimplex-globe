"use strict";

const geodesy = require("geodesy");
const THREE = require("three");
const LatLon = require("geodesy").LatLonSpherical;

const equatorialRadiusMajor = 6378137.0;
const equatorialRadiusMajorOverPI = equatorialRadiusMajor * Math.PI;
const equatorialRadiusMinor = 6356752.314245179;
const maximumLatitude = mercatorAngleToGeodeticLatitude(Math.PI);

// rename: wgs84 to cartesian
function wgs84toSpherical(latitude, longitude, radius = 1) {
    const theta = radians(clamp(90 - latitude, 0, 180));
    const phi = radians(clamp(longitude, -180, 180));

    return [
        radius * (Math.sin(theta) * Math.sin(phi)),
        radius * Math.cos(theta),
        radius * (Math.sin(theta) * Math.cos(phi))
    ];
}

function wgs84toMercator(latitude, longitude, height = 1) {
    return [
        radians(longitude),
        geodeticLatitudeToMercatorAngle(radians(latitude)),
        height
    ]
}

function mercatorToWgs84({x, y, z}) {
    const lon = degrees(x / equatorialRadiusMajor);
    const lat = degrees(mercatorAngleToGeodeticLatitude(y / equatorialRadiusMajor));
    return {lat, lon, height: z};
}

function mercatorYToLat(y) {
    return degrees(Math.PI * 0.5 - (2.0 * Math.atan(Math.exp(-(y / equatorialRadiusMajor)))));
}

function mercatorToSpherical(mercator) {
    const wgs84 = mercatorToWgs84({x: mercator.x, y: mercator.y});
    return wgs84toSpherical(wgs84.lat, wgs84.lon);
}

function cartesianToSpherical(position) {
    const radius = Math.sqrt(position.x * position.x + position.y * position.y + position.z * position.z)
    return {
        radius: radius,
        theta: Math.acos(position.y / radius),
        phi: Math.atan2(position.x, position.z)
    };
}

function cartesianToWgs84(position) {
    const spherical = cartesianToSpherical(position);
    return {
        lat: 90 - degrees(spherical.theta),
        lon: degrees(spherical.phi),
        height: spherical.radius
    };
}

function mercatorAngleToGeodeticLatitude(mercatorAngle) {
    return Math.PI * 0.5 - (2.0 * Math.atan(Math.exp(-mercatorAngle)));
}

function geodeticLatitudeToMercatorAngle(latitude) {
    if (latitude >= maximumLatitude) {
        latitude = maximumLatitude;
    } else if (latitude <= -maximumLatitude) {
        latitude = -maximumLatitude;
    }

    const sinLatitude = Math.sin(latitude);
    return 0.5 * Math.log((1.0 + sinLatitude) / (1.0 - sinLatitude));
}

function cartesianToMercator(position) {
    const wgs84 = cartesianToWgs84(position);
    return {
        x: radians(wgs84.lon * equatorialRadiusMajor),
        y: radians(geodeticLatitudeToMercatorAngle(wgs84.lat) * equatorialRadiusMajor)
    }
}

function mapWgs84(sphericalMapping, latitude, longitude, height = 1) {
    return sphericalMapping
        ? wgs84toSpherical(latitude, longitude, height)
        : wgs84toMercator(latitude, longitude, height);
}

function radians(degrees) {
    return degrees * Math.PI / 180;
}

function degrees(radians) {
    return radians * 180 / Math.PI;
}

function clamp(number, min, max) {
    return Math.min(Math.max(number, min), max);
}

function calculateOffsetVectors(position, tangent, width, positions, normals) {
    const normal = position.clone().normalize();
    const binormal = new THREE.Vector3().crossVectors(tangent, normal).normalize();

    const offsetLeft = binormal.clone().multiplyScalar(width / 2);
    const offsetRight = binormal.clone().multiplyScalar(-width / 2);
    const positionLeft = new THREE.Vector3().addVectors(position, offsetLeft);
    const positionRight = new THREE.Vector3().addVectors(position, offsetRight);

    positions.push(positionLeft.x, positionLeft.y, positionLeft.z);
    positions.push(positionRight.x, positionRight.y, positionRight.z);

    normals.push(normal.x, normal.y, normal.z);
    normals.push(normal.x, normal.y, normal.z);
}

function remapVertexBuffer(positions, normals, sphericalMapping) {
    // update positions & normals
    if (sphericalMapping) {
        // convert mercator to wgs84 to spherical
        for (let n = 0; n < positions.length; n += 3) {
            const wgs84 = mercatorToWgs84({
                x: positions[n + 0] * equatorialRadiusMajor, //
                y: positions[n + 1] * equatorialRadiusMajor,
                z: positions[n + 2]
            });

            const newPosition = mapWgs84(sphericalMapping, wgs84.lat, wgs84.lon, wgs84.height);
            positions[n + 0] = newPosition[0];
            positions[n + 1] = newPosition[1];
            positions[n + 2] = newPosition[2];

            if (normals) {
                normals[n + 0] = newPosition[0];
                normals[n + 1] = newPosition[1];
                normals[n + 2] = newPosition[2];
            }
        }
    } else {
        // convert cartesian to wgs84 to mercator
        for (let n = 0; n < positions.length; n += 3) {
            const wgs84 = cartesianToWgs84({
                x: positions[n + 0],
                y: positions[n + 1],
                z: positions[n + 2]
            });

            const newPosition = mapWgs84(sphericalMapping, wgs84.lat, wgs84.lon, wgs84.height);
            positions[n + 0] = newPosition[0];
            positions[n + 1] = newPosition[1];
            positions[n + 2] = newPosition[2];

            if (normals) {
                normals[n + 0] = 0;
                normals[n + 1] = 0;
                normals[n + 2] = 1;
            }
        }
    }
}

module.exports = {
    wgs84toSpherical,
    wgs84toMercator,
    mercatorToWgs84,
    radians,
    degrees,
    clamp,
    equatorialRadiusMajor,
    equatorialRadiusMinor,
    equatorialRadiusMajorOverPI,
    cartesianToSpherical,
    cartesianToWgs84,
    cartesianToMercator,
    mercatorToSpherical,
    mercatorYToLat,
    mapWgs84,
    calculateOffsetVectors,
    maximumLatitude,
    remapVertexBuffer
}
