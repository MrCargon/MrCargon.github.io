// GlobeMath.js - Shared sphere/lat-lng math for globe markers.
// Reusable by the solar-system Earth marker and the future react-globe.gl flagship.
// Vanilla, global THREE, no module system (matches the rest of the codebase).
const GlobeMath = {
    /**
     * Convert geographic coordinates to a position on a sphere of given radius.
     *
     * Mapping matches a standard equirectangular Earth texture on a THREE
     * SphereGeometry (left edge of map = lng -180, seam at the back).
     * If a globe's day map is mirrored, flip the sign of the X term (see flipX).
     *
     * @param {number} lat - Latitude in degrees  [-90, 90]
     * @param {number} lng - Longitude in degrees [-180, 180]
     * @param {number} radius - Sphere radius (> 0)
     * @param {boolean} [flipX=false] - Mirror east/west if the texture is flipped
     * @returns {THREE.Vector3} Point on the sphere surface
     */
    latLngToVector3(lat, lng, radius, flipX = false) {
        // NASA Rule 5: validate inputs at smallest scope.
        console.assert(typeof THREE !== 'undefined', 'GlobeMath: THREE required');
        console.assert(Number.isFinite(lat) && lat >= -90 && lat <= 90,
            'GlobeMath.latLngToVector3: lat out of range');
        console.assert(Number.isFinite(lng) && Number.isFinite(radius) && radius > 0,
            'GlobeMath.latLngToVector3: lng/radius invalid');

        const phi = (90 - lat) * Math.PI / 180;
        const theta = (lng + 180) * Math.PI / 180;

        const sinPhi = Math.sin(phi);
        const xSign = flipX ? 1 : -1;
        const x = xSign * radius * sinPhi * Math.cos(theta);
        const z = radius * sinPhi * Math.sin(theta);
        const y = radius * Math.cos(phi);

        return new THREE.Vector3(x, y, z);
    },

    /**
     * Inverse of latLngToVector3 (flipX=false): a point on the sphere → lat/lng.
     * Used for hover hit-testing (raycast the globe → which country is here?).
     * @param {THREE.Vector3|{x,y,z}} v - point in the sphere's LOCAL space
     * @param {number} radius - sphere radius (> 0)
     * @returns {{lat:number, lng:number}}
     */
    vector3ToLatLng(v, radius) {
        console.assert(v && Number.isFinite(v.x), 'GlobeMath.vector3ToLatLng: vector required');
        console.assert(Number.isFinite(radius) && radius > 0, 'GlobeMath.vector3ToLatLng: radius invalid');
        const r = radius || Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;
        const lat = 90 - Math.acos(Math.max(-1, Math.min(1, v.y / r))) * 180 / Math.PI;
        let lng = Math.atan2(v.z, -v.x) * 180 / Math.PI - 180;
        while (lng < -180) lng += 360;
        while (lng > 180) lng -= 360;
        return { lat: lat, lng: lng };
    }
};

// Make globally available (matches ResourceLoader / SolarSystem pattern).
if (typeof window !== 'undefined') {
    window.GlobeMath = GlobeMath;
}
