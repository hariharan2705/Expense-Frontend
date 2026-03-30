import { useState, useEffect, useRef, useCallback } from "react";

const GOOGLE_MAPS_API_KEY = "AIzaSyCtdA5MNA7rw-DQfh1KKFlA-s-PjmohdOQ";

// ─── Mock Visualforce remoting (replace with real API calls) ──────────────────
const mockGetUsers = () =>
    Promise.resolve([
        { id: "001", name: "Alice Johnson" },
        { id: "002", name: "Bob Smith" },
        { id: "003", name: "Carol White" },
    ]);

const mockGetTrackingData = (userId: any, date: any) =>
    Promise.resolve({
        pathData: [
            "{ lat=13.0200, lng=80.2300 }",
            "{ lat=13.0250, lng=80.2350 }",
            "{ lat=13.0300, lng=80.2400 }",
            "{ lat=13.0350, lng=80.2450 }",
        ],
        shortestPathData: [
            "{ lat=13.0200, lng=80.2300 }",
            "{ lat=13.0350, lng=80.2450 }",
        ],
    });

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseCoords(item: any) {
    const fixed = item
        .replace(/lat=/g, '"lat":')
        .replace(/lng=/g, '"lng":')
        .replace(/([{,])\s*(\w+)\s*:/g, '$1 "$2":');
    return JSON.parse(fixed);
}

function getRouteColor(index) {
    const colors = [
        "#FF4136", "#0074D9", "#FF851B", "#B10DC9",
        "#00BCD4", "#8BC34A", "#E91E63", "#795548",
    ];
    return colors[index % colors.length];
}

// ─── Load Google Maps script once ─────────────────────────────────────────────
let mapsLoaded = false;
let mapsLoadingPromise = null;

function loadGoogleMaps() {
    if (mapsLoaded) return Promise.resolve();
    if (mapsLoadingPromise) return mapsLoadingPromise;
    mapsLoadingPromise = new Promise((resolve, reject) => {
        if (window.google && window.google.maps) {
            mapsLoaded = true;
            resolve();
            return;
        }
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
        script.async = true;
        script.onload = () => {
            mapsLoaded = true;
            resolve();
        };
        script.onerror = reject;
        document.head.appendChild(script);
    });
    return mapsLoadingPromise;
}

// ─── SnapToRoads ──────────────────────────────────────────────────────────────
async function snapToRoads(path) {
    const CHUNK_SIZE = 100;
    const chunks = [];
    for (let i = 0; i < path.length; i += CHUNK_SIZE) {
        chunks.push(path.slice(i, i + CHUNK_SIZE));
    }
    const finalPath = [];
    for (const chunk of chunks) {
        const pathString = chunk.map((p) => `${p.lat},${p.lng}`).join("|");
        const url =
            `https://roads.googleapis.com/v1/snapToRoads?interpolate=true&key=${GOOGLE_MAPS_API_KEY}&path=` +
            encodeURIComponent(pathString);
        try {
            const res = await fetch(url);
            const data = await res.json();
            if (data.snappedPoints && data.snappedPoints.length > 0) {
                data.snappedPoints.forEach((pt) =>
                    finalPath.push({ lat: pt.location.latitude, lng: pt.location.longitude })
                );
            } else {
                chunk.forEach((p) => finalPath.push(p));
            }
        } catch {
            chunk.forEach((p) => finalPath.push(p));
        }
    }
    return finalPath;
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function TravelledMap() {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markersRef = useRef([]);
    const polylinesRef = useRef([]);
    const directionRenderersRef = useRef([]);

    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState("");
    const [selectedDate, setSelectedDate] = useState("");
    const [status, setStatus] = useState("Select a user and date to view route.");
    const [loading, setLoading] = useState(false);
    const [mapsReady, setMapsReady] = useState(false);

    // Load Google Maps
    useEffect(() => {
        loadGoogleMaps().then(() => setMapsReady(true));
    }, []);

    // Init map
    useEffect(() => {
        if (!mapsReady || !mapRef.current) return;
        mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
            center: { lat: 13.02, lng: 80.23 },
            zoom: 14,
            mapTypeControl: true,
            fullscreenControl: true,
            streetViewControl: false,
            styles: [
                { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
            ],
        });
    }, [mapsReady]);

    // Populate users
    useEffect(() => {
        mockGetUsers().then(setUsers);
    }, []);

    // ─── Clear ────────────────────────────────────────────────────────────────
    const clearAllData = useCallback(() => {
        directionRenderersRef.current.forEach((r) => r.setMap(null));
        directionRenderersRef.current = [];
        polylinesRef.current.forEach((p) => p.setMap(null));
        polylinesRef.current = [];
        markersRef.current.forEach((m) => m.setMap(null));
        markersRef.current = [];
        setStatus("Map cleared. Select a user and date to load a route.");
    }, []);

    // ─── Add markers ──────────────────────────────────────────────────────────
    const addMarkers = useCallback((route, startLabel, endLabel, bounds, fillColor = "#FF4136") => {
        const map = mapInstanceRef.current;
        if (!map || route.length < 2) return;
        const startPos = new window.google.maps.LatLng(route[0].lat, route[0].lng);
        const endPos = new window.google.maps.LatLng(
            route[route.length - 1].lat,
            route[route.length - 1].lng
        );
        [
            { pos: startPos, label: startLabel, color: fillColor },
            { pos: endPos, label: endLabel, color: "#1a1a2e" },
        ].forEach(({ pos, label, color }) => {
            const marker = new window.google.maps.Marker({
                position: pos,
                map,
                label: { text: label, color: "#fff", fontWeight: "bold", fontSize: "11px" },
                icon: {
                    path: window.google.maps.SymbolPath.CIRCLE,
                    scale: 11,
                    fillColor: color,
                    fillOpacity: 1,
                    strokeColor: "#fff",
                    strokeWeight: 2,
                },
            });
            markersRef.current.push(marker);
            bounds?.extend(pos);
        });
    }, []);

    // ─── Add shortest markers ─────────────────────────────────────────────────
    const addShortestMarkers = useCallback((route, startLabel, endLabel) => {
        const map = mapInstanceRef.current;
        if (!map || route.length < 2) return;
        const startPos = new window.google.maps.LatLng(route[0].lat, route[0].lng);
        const endPos = new window.google.maps.LatLng(
            route[route.length - 1].lat,
            route[route.length - 1].lng
        );
        [
            { pos: startPos, label: startLabel, color: "#008000" },
            { pos: endPos, label: endLabel, color: "#004d00" },
        ].forEach(({ pos, label, color }) => {
            const marker = new window.google.maps.Marker({
                position: pos,
                map,
                label: { text: label, color: "#fff", fontWeight: "bold", fontSize: "11px" },
                icon: {
                    path: window.google.maps.SymbolPath.CIRCLE,
                    scale: 11,
                    fillColor: color,
                    fillOpacity: 1,
                    strokeColor: "#fff",
                    strokeWeight: 2,
                },
            });
            markersRef.current.push(marker);
        });
    }, []);

    // ─── Draw snapped polyline ────────────────────────────────────────────────
    const drawSnappedPolyline = useCallback((path, color) => {
        const polyline = new window.google.maps.Polyline({
            path,
            strokeColor: color,
            strokeWeight: 4,
            strokeOpacity: 0.9,
        });
        polyline.setMap(mapInstanceRef.current);
        polylinesRef.current.push(polyline);
    }, []);

    // ─── Draw directions route ────────────────────────────────────────────────
    const drawDirectionsRoute = useCallback(
        (routeCoords, color, labelStart, labelEnd) => {
            if (!routeCoords || routeCoords.length < 2) return;
            const directionsService = new window.google.maps.DirectionsService();
            const renderer = new window.google.maps.DirectionsRenderer({
                suppressMarkers: true,
                preserveViewport: true,
                polylineOptions: { strokeColor: color, strokeWeight: 4, strokeOpacity: 0.9 },
            });
            renderer.setMap(mapInstanceRef.current);
            directionRenderersRef.current.push(renderer);
            directionsService.route(
                {
                    origin: new window.google.maps.LatLng(routeCoords[0].lat, routeCoords[0].lng),
                    destination: new window.google.maps.LatLng(
                        routeCoords[routeCoords.length - 1].lat,
                        routeCoords[routeCoords.length - 1].lng
                    ),
                    travelMode: window.google.maps.TravelMode.DRIVING,
                },
                (result, status) => {
                    if (status === "OK") {
                        renderer.setDirections(result);
                        addShortestMarkers(routeCoords, labelStart, labelEnd);
                    } else {
                        console.error("Directions failed:", status);
                    }
                }
            );
        },
        [addShortestMarkers]
    );

    // ─── Draw all paths ───────────────────────────────────────────────────────
    const drawAllPaths = useCallback(
        async (travelledRoutes, shortestRoutes) => {
            const total = travelledRoutes.length;
            if (total === 0) {
                setStatus("No routes found.");
                setLoading(false);
                return;
            }
            setStatus(`⏳ Snapping ${total} route(s) to roads...`);
            const bounds = new window.google.maps.LatLngBounds();
            let alphabetIndex = 0;
            let shortestIndex = 1;

            for (let i = 0; i < total; i++) {
                const travelled = travelledRoutes[i] || [];
                const shortest = shortestRoutes[i] || [];
                const travelColor = getRouteColor(i);
                const shortestColor = getRouteColor(i + 10);
                const startLabel = String.fromCharCode(65 + alphabetIndex++);
                const endLabel = String.fromCharCode(65 + alphabetIndex++);
                const sStart = "S" + shortestIndex++;
                const sEnd = "S" + shortestIndex++;

                if (travelled.length >= 2) {
                    const snapped = await snapToRoads(travelled);
                    drawSnappedPolyline(snapped, travelColor);
                    addMarkers(snapped, startLabel, endLabel, bounds, travelColor);
                }
                if (shortest.length >= 2) {
                    drawDirectionsRoute(shortest, shortestColor, sStart, sEnd);
                }
            }
            mapInstanceRef.current.fitBounds(bounds);
            setStatus(`✅ Loaded ${total} route(s) successfully.`);
            setLoading(false);
        },
        [drawSnappedPolyline, addMarkers, drawDirectionsRoute]
    );

    // ─── Load data ────────────────────────────────────────────────────────────
    const loadTrackingData = useCallback(async () => {
        if (!selectedUser || !selectedDate) {
            alert("Please select both a user and a date.");
            return;
        }
        setLoading(true);
        setStatus("⏳ Loading tracking data...");
        clearAllData();

        try {
            // Replace mockGetTrackingData with real API / Visualforce remoting call:
            const result = await mockGetTrackingData(selectedUser, selectedDate);
            if (result) {
                const travelled = result.pathData.map(parseCoords);
                const shortest = result.shortestPathData.map(parseCoords);
                await drawAllPaths(travelled, shortest);
            } else {
                setStatus("⚠️ No data found for selected user and date.");
                setLoading(false);
            }
        } catch (err) {
            console.error(err);
            setStatus("❌ Error loading data.");
            setLoading(false);
        }
    }, [selectedUser, selectedDate, clearAllData, drawAllPaths]);

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div style={styles.wrapper}>
            {/* Panel */}
            <div style={styles.panel}>
                <div style={styles.panelLeft}>
                    <div style={styles.field}>
                        <label style={styles.label}>User</label>
                        <select
                            value={selectedUser}
                            onChange={(e) => setSelectedUser(e.target.value)}
                            style={styles.select}
                        >
                            <option value="">— Select User —</option>
                            {users.map((u) => (
                                <option key={u.id} value={u.id}>
                                    {u.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div style={styles.field}>
                        <label style={styles.label}>Date</label>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            style={styles.select}
                        />
                    </div>

                    <button
                        onClick={loadTrackingData}
                        disabled={loading}
                        style={{ ...styles.btn, ...styles.btnPrimary, ...(loading ? styles.btnDisabled : {}) }}
                    >
                        {loading ? "⏳ Loading…" : "📍 Load Route"}
                    </button>

                    <button
                        onClick={clearAllData}
                        disabled={loading}
                        style={{ ...styles.btn, ...styles.btnDanger, ...(loading ? styles.btnDisabled : {}) }}
                    >
                        ✕ Clear
                    </button>
                </div>

                <div style={styles.status}>{status}</div>
            </div>

            {/* Map */}
            {!mapsReady && (
                <div style={styles.mapLoading}>
                    <span style={styles.mapLoadingText}>Loading Google Maps…</span>
                </div>
            )}
            <div ref={mapRef} style={{ ...styles.map, display: mapsReady ? "block" : "none" }} />

            {/* Legend */}
            {mapsReady && (
                <div style={styles.legend}>
                    <div style={styles.legendTitle}>Legend</div>
                    <div style={styles.legendItem}>
                        <div style={{ ...styles.dot, background: "#FF4136" }} />
                        <span>Travelled Route</span>
                    </div>
                    <div style={styles.legendItem}>
                        <div style={{ ...styles.dot, background: "#008000" }} />
                        <span>Shortest Route</span>
                    </div>
                    <div style={styles.legendItem}>
                        <div style={{ ...styles.dot, background: "#FF4136", width: 12, height: 12, borderRadius: "50%" }} />
                        <span style={{ marginLeft: 4 }}>Start Marker (A, B…)</span>
                    </div>
                    <div style={styles.legendItem}>
                        <div style={{ ...styles.dot, background: "#1a1a2e", width: 12, height: 12, borderRadius: "50%" }} />
                        <span style={{ marginLeft: 4 }}>End Marker</span>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = {
    wrapper: {
        position: "relative",
        width: "100%",
        height: "100vh",
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
    },
    panel: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 18px",
        background: "#fff",
        borderBottom: "1px solid #e0e0e0",
        boxShadow: "0 2px 6px rgba(0,0,0,0.07)",
        flexWrap: "wrap",
        gap: 8,
        minHeight: 58,
        boxSizing: "border-box",
        zIndex: 10,
    },
    panelLeft: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
    },
    field: {
        display: "flex",
        alignItems: "center",
        gap: 6,
    },
    label: {
        fontSize: 13,
        fontWeight: 600,
        color: "#444",
        whiteSpace: "nowrap",
    },
    select: {
        padding: "5px 8px",
        border: "1px solid #ccc",
        borderRadius: 5,
        fontSize: 13,
        color: "#333",
        background: "#fafafa",
        outline: "none",
        cursor: "pointer",
    },
    btn: {
        padding: "6px 14px",
        border: "none",
        borderRadius: 5,
        fontSize: 13,
        cursor: "pointer",
        fontWeight: 600,
        transition: "background 0.2s",
    },
    btnPrimary: {
        background: "#4285F4",
        color: "#fff",
    },
    btnDanger: {
        background: "#EA4335",
        color: "#fff",
    },
    btnDisabled: {
        background: "#bbb",
        cursor: "not-allowed",
    },
    status: {
        fontSize: 12,
        color: "#555",
        marginLeft: "auto",
        paddingLeft: 16,
        maxWidth: 320,
        textAlign: "right",
    },
    map: {
        flex: 1,
        width: "100%",
    },
    mapLoading: {
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f5f5f5",
    },
    mapLoadingText: {
        fontSize: 15,
        color: "#888",
    },
    legend: {
        position: "absolute",
        bottom: 36,
        left: 12,
        zIndex: 5,
        background: "rgba(255,255,255,0.95)",
        padding: "10px 14px",
        borderRadius: 8,
        border: "1px solid #ddd",
        fontSize: 12,
        lineHeight: "22px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
        minWidth: 190,
    },
    legendTitle: {
        fontWeight: 700,
        fontSize: 13,
        marginBottom: 4,
        color: "#222",
    },
    legendItem: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        color: "#444",
    },
    dot: {
        width: 28,
        height: 6,
        borderRadius: 3,
        flexShrink: 0,
    },
};