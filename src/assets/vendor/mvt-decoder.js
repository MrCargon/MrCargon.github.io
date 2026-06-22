// mvt-decoder.js - Minimal self-contained Mapbox Vector Tile (MVT) decoder.
//
// Why this exists: the global street engine needs to turn a raw .pbf vector
// tile (from OpenFreeMap, keyless + CORS) into line features WITHOUT a bundler.
// Mapbox's @mapbox/vector-tile + pbf ship as ES modules / a split global, so
// instead we vendor ONE tiny standalone decoder that loads as a classic
// <script> and exposes a single global: window.MVT.
//
// Scope (deliberately small): just enough of the protobuf wire format + the MVT
// geometry commands (MoveTo / LineTo / ClosePath over zig-zag ints) to extract
// LINE features (roads, waterways, transportation). Polygons are decoded the
// same way (rings of points) so they can be drawn as outlines if wanted.
//
// Spec: https://github.com/mapbox/vector-tile-spec (v2.1)
// NASA Power-of-10 style: bounded loops, >=2 asserts per method, fail-soft,
// methods small. No external dependency. global THREE not required here.
(function (global) {
    'use strict';

    // Geometry types (MVT spec §4.3.4).
    var GEOM_UNKNOWN = 0, GEOM_POINT = 1, GEOM_LINESTRING = 2, GEOM_POLYGON = 3;

    // ---- Tiny protobuf reader (varint + length-delimited only) -------------
    // We only need: varint (wire 0), 64-bit fixed (wire 1, skipped), length-
    // delimited (wire 2), 32-bit fixed (wire 5, skipped). Enough for MVT.
    function PB(buf) {
        console.assert(buf && typeof buf.length === 'number', 'PB: byte buffer required');
        console.assert(buf instanceof Uint8Array, 'PB: Uint8Array required');
        this.buf = buf;
        this.pos = 0;
        this.len = buf.length;
    }

    // Read an unsigned varint. Bounded to 10 bytes (Rule 2). Returns a Number
    // (MVT ids/values fit in 53 bits comfortably for tile-local data).
    PB.prototype.varint = function () {
        console.assert(this.pos < this.len, 'PB.varint: read past end');
        var result = 0, shift = 0, b, guard = 0;
        do {
            console.assert(guard < 10, 'PB.varint: varint too long');
            b = this.buf[this.pos++];
            result += (b & 0x7f) * Math.pow(2, shift);
            shift += 7;
            guard++;
        } while (b >= 0x80 && this.pos < this.len && guard < 10);
        return result;
    };

    // Zig-zag decode (MVT geometry deltas are zig-zag varints).
    PB.prototype.svarint = function () {
        console.assert(this.pos <= this.len, 'PB.svarint: position valid');
        var n = this.varint();
        console.assert(n >= 0, 'PB.svarint: non-negative varint');
        return (n >>> 1) ^ -(n & 1);
    };

    // Skip a field whose wire type we don't consume. Rule 2: bounded by len.
    PB.prototype.skip = function (wire) {
        console.assert(typeof wire === 'number', 'PB.skip: wire type required');
        console.assert(this.pos <= this.len, 'PB.skip: position valid');
        if (wire === 0) { this.varint(); }
        else if (wire === 1) { this.pos += 8; }
        else if (wire === 2) { var l = this.varint(); this.pos += l; }
        else if (wire === 5) { this.pos += 4; }
        else { this.pos = this.len; }   // unknown → stop (fail-soft)
    };

    // ---- MVT structure -----------------------------------------------------
    // Tile { repeated Layer layers = 3; }
    // Layer { name=1, repeated Feature features=2, repeated string keys=3,
    //         repeated Value values=4, uint32 extent=5, uint32 version=15 }
    // Feature { id=1, repeated uint32 tags=2, GeomType type=3,
    //           repeated uint32 geometry=4 }

    // Decode every layer in the tile. Returns { layerName: {extent, features[]} }.
    // Rule 4: <=60 lines. Fail-soft: a malformed layer is skipped, not fatal.
    function decode(bytes) {
        console.assert(bytes, 'MVT.decode: bytes required');
        console.assert(bytes.length > 0, 'MVT.decode: non-empty tile required');
        var u8 = (bytes instanceof Uint8Array) ? bytes : new Uint8Array(bytes);
        var pb = new PB(u8);
        var layers = {};
        var guard = 0;
        while (pb.pos < pb.len && guard < 4096) {     // Rule 2: bounded
            guard++;
            var tag = pb.varint();
            var field = tag >> 3, wire = tag & 0x7;
            if (field === 3 && wire === 2) {
                var l = pb.varint();
                var end = pb.pos + l;
                try {
                    var layer = decodeLayer(u8, pb.pos, end);
                    if (layer && layer.name) layers[layer.name] = layer;
                } catch (e) {
                    // fail-soft per layer
                }
                pb.pos = end;
            } else {
                pb.skip(wire);
            }
        }
        return layers;
    }

    // Decode a single Layer message in [start,end). Rule 4: <=60 lines.
    function decodeLayer(u8, start, end) {
        console.assert(end > start, 'decodeLayer: valid range');
        console.assert(end <= u8.length, 'decodeLayer: range within buffer');
        var pb = new PB(u8); pb.pos = start; pb.len = end;
        var name = '', extent = 4096, version = 1;
        var keys = [], values = [], featureBlobs = [];
        var guard = 0;
        while (pb.pos < end && guard < 100000) {       // Rule 2: bounded
            guard++;
            var tag = pb.varint();
            var field = tag >> 3, wire = tag & 0x7;
            if (field === 15) { version = pb.varint(); }
            else if (field === 1 && wire === 2) { name = readString(pb); }
            else if (field === 5) { extent = pb.varint(); }
            else if (field === 3 && wire === 2) { keys.push(readString(pb)); }
            else if (field === 4 && wire === 2) { values.push(readValue(pb)); }
            else if (field === 2 && wire === 2) {
                var fl = pb.varint(); featureBlobs.push([pb.pos, pb.pos + fl]); pb.pos += fl;
            } else { pb.skip(wire); }
        }
        var features = [];
        var fmax = Math.min(featureBlobs.length, 200000);   // Rule 2: bounded
        for (var i = 0; i < fmax; i++) {
            var f = decodeFeature(u8, featureBlobs[i][0], featureBlobs[i][1], keys, values);
            if (f) features.push(f);
        }
        return { name: name, extent: extent, version: version, features: features };
    }

    // Decode a Feature message. Returns {type, geometry:[[ {x,y} ... ]], properties}.
    // Rule 4: <=60 lines.
    function decodeFeature(u8, start, end, keys, values) {
        console.assert(Array.isArray(keys), 'decodeFeature: keys array required');
        console.assert(Array.isArray(values), 'decodeFeature: values array required');
        var pb = new PB(u8); pb.pos = start; pb.len = end;
        var type = GEOM_UNKNOWN, tags = [], geomInts = [];
        var guard = 0;
        while (pb.pos < end && guard < 100000) {        // Rule 2: bounded
            guard++;
            var tag = pb.varint();
            var field = tag >> 3, wire = tag & 0x7;
            if (field === 3) { type = pb.varint(); }
            else if (field === 2 && wire === 2) { tags = readPacked(pb); }
            else if (field === 4 && wire === 2) { geomInts = readPacked(pb); }
            else if (field === 1) { pb.varint(); }      // id (ignored)
            else { pb.skip(wire); }
        }
        var props = {};
        for (var t = 0; t + 1 < tags.length; t += 2) {
            var k = keys[tags[t]];
            if (k !== undefined) props[k] = values[tags[t + 1]];
        }
        return { type: type, geometry: decodeGeometry(geomInts), properties: props };
    }

    // Decode the MVT command/geometry stream into arrays of {x,y} (tile-local,
    // 0..extent). Commands: 1=MoveTo, 2=LineTo, 7=ClosePath. Rule 4: <=60 lines.
    function decodeGeometry(g) {
        console.assert(Array.isArray(g), 'decodeGeometry: int array required');
        console.assert(g.length >= 0, 'decodeGeometry: array length valid');
        var rings = [], cur = null, x = 0, y = 0, i = 0;
        var guard = 0;
        while (i < g.length && guard < 2000000) {        // Rule 2: bounded
            guard++;
            var cmd = g[i] & 0x7, count = g[i] >> 3; i++;
            if (cmd === 1) {                              // MoveTo
                for (var m = 0; m < count && i + 1 < g.length; m++) {
                    x += zz(g[i++]); y += zz(g[i++]);
                    if (cur && cur.length) rings.push(cur);
                    cur = [{ x: x, y: y }];
                }
            } else if (cmd === 2) {                       // LineTo
                for (var n = 0; n < count && i + 1 < g.length; n++) {
                    x += zz(g[i++]); y += zz(g[i++]);
                    if (cur) cur.push({ x: x, y: y });
                }
            } else if (cmd === 7) {                       // ClosePath
                if (cur && cur.length) { cur.push({ x: cur[0].x, y: cur[0].y }); }
            } else {
                break;                                    // unknown command → stop
            }
        }
        if (cur && cur.length) rings.push(cur);
        return rings;
    }

    // ---- small helpers -----------------------------------------------------
    function zz(n) { return (n >>> 1) ^ -(n & 1); }      // zig-zag decode

    function readString(pb) {
        console.assert(pb && pb.buf, 'readString: pb required');
        var l = pb.varint();
        console.assert(pb.pos + l <= pb.len + 0, 'readString: within buffer');
        var s = '', endp = pb.pos + l;
        // UTF-8 decode (TextDecoder when available, else a bounded fallback).
        if (typeof TextDecoder !== 'undefined') {
            s = new TextDecoder('utf-8').decode(pb.buf.subarray(pb.pos, endp));
            pb.pos = endp; return s;
        }
        while (pb.pos < endp) { s += String.fromCharCode(pb.buf[pb.pos++]); }
        return s;
    }

    // Value { string=1, float=2, double=3, int64=4, uint64=5, sint64=6, bool=7 }
    function readValue(pb) {
        console.assert(pb && pb.buf, 'readValue: pb required');
        var l = pb.varint(), end = pb.pos + l, val = null, guard = 0;
        console.assert(end <= pb.len, 'readValue: within buffer');
        while (pb.pos < end && guard < 16) {
            guard++;
            var tag = pb.varint(), field = tag >> 3, wire = tag & 0x7;
            if (field === 1 && wire === 2) { val = readString(pb); }
            else if (field === 2 && wire === 5) {
                var dv = new DataView(pb.buf.buffer, pb.buf.byteOffset + pb.pos, 4);
                val = dv.getFloat32(0, true); pb.pos += 4;
            } else if (field === 3 && wire === 1) {
                var dv2 = new DataView(pb.buf.buffer, pb.buf.byteOffset + pb.pos, 8);
                val = dv2.getFloat64(0, true); pb.pos += 8;
            } else if (field === 4 || field === 5) { val = pb.varint(); }
            else if (field === 6) { val = pb.svarint(); }
            else if (field === 7) { val = pb.varint() !== 0; }
            else { pb.skip(wire); }
        }
        pb.pos = end;
        return val;
    }

    // Read a packed repeated uint32 field into a plain array. Rule 2: bounded.
    function readPacked(pb) {
        console.assert(pb && pb.buf, 'readPacked: pb required');
        var l = pb.varint(), end = pb.pos + l, out = [], guard = 0;
        console.assert(end <= pb.len, 'readPacked: within buffer');
        while (pb.pos < end && guard < 4000000) { guard++; out.push(pb.varint()); }
        return out;
    }

    var MVT = {
        decode: decode,
        GEOM_UNKNOWN: GEOM_UNKNOWN,
        GEOM_POINT: GEOM_POINT,
        GEOM_LINESTRING: GEOM_LINESTRING,
        GEOM_POLYGON: GEOM_POLYGON
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = MVT;
    if (typeof global !== 'undefined') global.MVT = MVT;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
