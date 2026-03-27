import React, { useState, useRef, useEffect } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import "./Calendar.css";
import api from "../../lib/api";

/* ── Event types — add / remove / recolor freely ─────────── */
const EVENT_TYPES = [
    { label: "Meeting", color: "#2563eb", icon: "👥" },
    { label: "Call", color: "#06a59a", icon: "📞" },
    { label: "Task", color: "#16a34a", icon: "✅" },
    { label: "Demo", color: "#7c3aed", icon: "🖥️" },
    { label: "Follow-Up", color: "#d97706", icon: "🔔" },
    { label: "Deadline", color: "#dc2626", icon: "⚠️" },
];

/* ── Helpers ─────────────────────────────────────────────── */
const typeColor = (t: any) => EVENT_TYPES.find(e => e.label === t)?.color || "#2563eb";
const typeIcon = (t: any) => EVENT_TYPES.find(e => e.label === t)?.icon || "📅";
const fmtTime = (iso: any) => iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
const fmtDate = (iso: any) => iso ? new Date(iso).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }) : "";
const toLocal = (iso: any) => iso ? iso.slice(0, 16) : "";
const tstObj = {
    "checkoutComments": "btg",
    "contactPerson": "vignesh",
    "createdBy": "Hari",
    "desc": "",
    "endDate": "2026-04-03",
    "endTime": "02:30",
    "from": "Chennai",
    "location": "",
    "meetingStatus": "yet_to_confirm",
    "meetingType": "online",
    "nextAction": "desc",
    "nextVisitDate": "2026-04-04",
    "purpose": "tsting",
    "startDate": "2026-04-03",
    "startTime": "01:29",
    "title": "Sample",
    "to": "Mumbai",
    "travelType": "flight",
    "type": "Meeting",
    "vehicleOwner": "Me"
}
const emptyForm = () => ({
    title: "",
    type: "Meeting",

    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    meetingType: "online",
    meetingStatus: "yet_to_confirm",
    createdBy: "Hari",
    location: "",
    desc: "",
    from: "",
    to: "",
    travelType: "",
    vehicleOwner: "",
    contactPerson: "",
    purpose: "",
    checkoutComments: "",
    nextVisitDate: "",
    nextAction: ""
});

const INITIAL_EVENTS = [
    { id: "1", title: "Team Standup", start: "2026-03-23T09:00:00", end: "2026-03-23T09:30:00", extendedProps: { type: "Meeting", location: "Conf Room A", desc: "Daily sync with the team" } },
    { id: "2", title: "Client Demo", start: "2026-03-25T14:00:00", end: "2026-03-25T15:00:00", extendedProps: { type: "Demo", location: "Zoom", desc: "Product walkthrough for new client" } },
    { id: "3", title: "Follow-Up Call", start: "2026-03-27T04:00:00", end: "2026-03-27T04:30:00", extendedProps: { type: "Follow-Up", location: "", desc: "" } },
    { id: "4", title: "Sprint Planning", start: "2026-03-26T10:00:00", end: "2026-03-26T11:30:00", extendedProps: { type: "Meeting", location: "Conf Room B", desc: "Q2 sprint planning session" } },
];


export default function CalendarView() {
    const calRef: any = useRef(null);
    const [events, setEvents]: any = useState(INITIAL_EVENTS);
    const [modal, setModal]: any = useState(null); // { mode: "create"|"edit"|"view", data? }
    const [form, setForm]: any = useState(emptyForm());
    const [view, setView] = useState("timeGridWeek");

    const [availableUsers, setAvailableUsers]: any = useState([]);

    useEffect(() => {
        const fetchEmployees = async () => {
            try {
                const response = await api.get("api/users");
                console.log(response, "response from employees");

                if (response?.data?.items) {
                    setAvailableUsers(response.data.items?.filter((emp: any) => emp.employeeName != ""));
                }
            } catch (err) {
                console.error("Failed to fetch employees", err);
            }
        };
        fetchEmployees();
    }, []);

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                const response: any = await api.get("api/events/get-by-attendees");
                console.log(response, "response from get-by-attendees");

                if (response?.data?.status == 'success') {
                    const formattedEvents = response.data.data.map((e: any) => ({
                        id: e.id,
                        title: e.subject, // ✅ subject → title
                        start: e.start_date_time, // ✅ start_date_time → start
                        end: e.end_date_time, // ✅ end_date_time → end
                    }));
                    setEvents(formattedEvents || []);
                }
            } catch (err) {
                console.error("Failed to fetch employees", err);
            }
        };
        fetchEvents();
    }, []);

    const [selectedUsers, setSelectedUsers]: any = useState([]);
    const [selectedAvailable, setSelectedAvailable]: any = useState([]);
    const [selectedChosen, setSelectedChosen]: any = useState([]);


    const closeModal = () => setModal(null);
    const patch = (k: any, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

    const toFCEvent = (f: any, id: any) => ({
        id: id || String(Date.now()),
        title: f.title,
        start: f.start,
        end: f.end,
        backgroundColor: typeColor(f.type),
        borderColor: typeColor(f.type),
        extendedProps: { type: f.type, location: f.location, desc: f.desc },
    });

    /* ── FullCalendar callbacks ─────────────────────────────── */
    const handleSelect = ({ startStr, endStr }: any) => {
        setForm({ ...emptyForm(), start: toLocal(startStr), end: toLocal(endStr) });
        setModal({ mode: "create" });
    };

    const moveToSelected = () => {
        const moved = availableUsers.filter((u: any) => selectedAvailable.includes(u.id));

        setSelectedUsers([...selectedUsers, ...moved]);
        setAvailableUsers(availableUsers.filter((u: any) => !selectedAvailable.includes(u.id)));
        setSelectedAvailable([]);
    };

    const moveToAvailable = () => {
        const moved = selectedUsers.filter((u: any) => selectedChosen.includes(u.id));

        setAvailableUsers([...availableUsers, ...moved]);
        setSelectedUsers(selectedUsers.filter((u: any) => !selectedChosen.includes(u.id)));
        setSelectedChosen([]);
    };

    const handleEventClick = ({ event }: any) => {
        setModal({
            mode: "view",
            data: {
                id: event.id,
                title: event.title,
                start: event.startStr,
                end: event.endStr,
                type: event.extendedProps.type,
                location: event.extendedProps.location,
                desc: event.extendedProps.desc,
                color: event.backgroundColor,
            },
        });
    };

    const handleEventDrop = ({ event }: any) => setEvents((p: any) => p.map((e: any) => e.id === event.id ? { ...e, start: event.startStr, end: event.endStr } : e));
    const handleEventResize = ({ event }: any) => setEvents((p: any) => p.map((e: any) => e.id === event.id ? { ...e, end: event.endStr } : e));

    /* ── CRUD ───────────────────────────────────────────────── */
    const saveEvent = async () => {
        if (!form.title.trim()) return;

        const start = `${form.startDate}T${form.startTime}:00Z`;
        const end = `${form.endDate}T${form.endTime}:00Z`;
        const payload = { ...form, subject: form?.title, startDate: start, endDate: end, "attendees": selectedUsers?.map((item: any) => item?.id) }
        console.log(payload, 'fmmm');
        const res = await api.post("/api/events", payload);
        console.log(res)
        setEvents((prev: any) => [
            ...prev,
            {
                id: Date.now().toString(),
                title: form.title,
                start,
                end,
                extendedProps: { ...form, attendees: selectedUsers }
            },
        ]);


        closeModal();
    };

    const deleteEvent = (id: any) => { setEvents((p: any) => p.filter((e: any) => e.id !== id)); closeModal(); };
    const startEdit = () => { setForm({ ...modal.data }); setModal({ mode: "edit" }); };
    const switchView = (v: any) => { setView(v); calRef.current?.getApi().changeView(v); };

    /* ── Render ─────────────────────────────────────────────── */
    return (
        <div className="cal-root">

            {/* ── Toolbar ── */}
            <div className="cal-toolbar">
                <div className="cal-nav">
                    <button className="cal-nav-arrow" onClick={() => calRef.current?.getApi().prev()}>‹</button>
                    <button className="cal-nav-arrow" onClick={() => calRef.current?.getApi().next()}>›</button>
                    <button className="cal-today-btn" onClick={() => calRef.current?.getApi().today()}>Today</button>
                </div>

                <div className="cal-view-tabs">
                    {[["dayGridMonth", "Month"], ["timeGridWeek", "Week"], ["timeGridDay", "Day"]].map(([key, label]) => (
                        <button
                            key={key}
                            className={`cal-tab${view === key ? " active" : ""}`}
                            onClick={() => switchView(key)}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                <button className="cal-new-btn" onClick={() => { setForm(emptyForm()); setModal({ mode: "create" }); }}>
                    + New Event
                </button>
            </div>

            {/* ── FullCalendar ── */}
            <div className="cal-body">
                <FullCalendar
                    ref={calRef}
                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                    initialView="timeGridWeek"
                    initialDate="2026-03-27"
                    headerToolbar={false}
                    events={events}
                    editable={true}
                    selectable={true}
                    selectMirror={true}
                    nowIndicator={true}
                    allDaySlot={false}
                    height="100%"
                    slotDuration="00:30:00"
                    select={handleSelect}
                    eventClick={handleEventClick}
                    eventDrop={handleEventDrop}
                    eventResize={handleEventResize}
                    eventContent={(info) => (
                        <div className="cal-event-pill">
                            <div className="cal-event-title">
                                {typeIcon(info.event.extendedProps.type)} {info.event.title}
                            </div>
                            <div className="cal-event-time">
                                {info.event.start?.toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                })}
                            </div>
                        </div>
                    )}
                    eventDidMount={(info) => {
                        const c = info.event.backgroundColor;
                        info.el.style.background = c + "1a";
                        info.el.style.border = `1px solid ${c}44`;
                        info.el.style.borderLeft = `3px solid ${c}`;
                        info.el.style.color = c;
                    }}
                />
            </div>

            {/* ── Modal ── */}
            {modal && (
                <div className="cal-backdrop" onClick={closeModal}>
                    <div className="cal-modal" onClick={e => e.stopPropagation()}>

                        {/* Header */}
                        <div
                            className="cal-modal-header"
                            style={{ background: modal.mode === "view" ? modal.data.color : "var(--primary)" }}
                        >
                            <div className="cal-modal-header-icon">
                                {modal.mode === "view" ? typeIcon(modal.data.type) : "📅"}
                            </div>
                            <div className="cal-modal-header-text">
                                {modal.mode === "view" && (
                                    <div className="cal-modal-type">{modal.data.type}</div>
                                )}
                                <div className="cal-modal-title">
                                    {modal.mode === "view"
                                        ? modal.data.title
                                        : modal.mode === "create" ? "New Event" : "Edit Event"}
                                </div>
                            </div>
                            <button className="cal-modal-close" onClick={closeModal}>✕</button>
                        </div>

                        {/* Body */}
                        <div className="cal-modal-body">
                            {modal.mode === "view" ? (
                                /* ── View rows ── */
                                <>
                                    <div className="cal-detail-row">
                                        <div className="cal-detail-icon">📅</div>
                                        <div>
                                            <div className="cal-detail-label">Date</div>
                                            <div className="cal-detail-value">{fmtDate(modal.data.start)}</div>
                                        </div>
                                    </div>
                                    <div className="cal-detail-row">
                                        <div className="cal-detail-icon">🕐</div>
                                        <div>
                                            <div className="cal-detail-label">Time</div>
                                            <div className="cal-detail-value">{fmtTime(modal.data.start)} – {fmtTime(modal.data.end)}</div>
                                        </div>
                                    </div>
                                    {modal.data.location && (
                                        <div className="cal-detail-row">
                                            <div className="cal-detail-icon">📍</div>
                                            <div>
                                                <div className="cal-detail-label">Location</div>
                                                <div className="cal-detail-value">{modal.data.location}</div>
                                            </div>
                                        </div>
                                    )}
                                    {modal.data.desc && (
                                        <div className="cal-detail-row">
                                            <div className="cal-detail-icon">📝</div>
                                            <div>
                                                <div className="cal-detail-label">Notes</div>
                                                <div className="cal-detail-value">{modal.data.desc}</div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (<>
                                <div className="form-section">
                                    <div className="form-section-title">Meeting Details</div>

                                    <div className="form-grid">

                                        <div className="form-field form-full">
                                            <label className="form-label">Subject *</label>
                                            <input className="form-input"
                                                value={form.title}
                                                onChange={(e) => patch("title", e.target.value)}
                                            />
                                        </div>

                                        <div className="form-field">
                                            <label className="form-label">Start Date</label>
                                            <input type="date" className="form-input"
                                                value={form.startDate}
                                                onChange={(e) => patch("startDate", e.target.value)}
                                            />
                                        </div>

                                        <div className="form-field">
                                            <label className="form-label">Start Time</label>
                                            <input type="time" className="form-input"
                                                value={form.startTime}
                                                onChange={(e) => patch("startTime", e.target.value)}
                                            />
                                        </div>

                                        <div className="form-field">
                                            <label className="form-label">End Date</label>
                                            <input type="date" className="form-input"
                                                value={form.endDate}
                                                onChange={(e) => patch("endDate", e.target.value)}
                                            />
                                        </div>

                                        <div className="form-field">
                                            <label className="form-label">End Time</label>
                                            <input type="time" className="form-input"
                                                value={form.endTime}
                                                onChange={(e) => patch("endTime", e.target.value)}
                                            />
                                        </div>

                                        <div className="form-field">
                                            <label className="form-label">Meeting Type</label>
                                            <select className="form-input"
                                                value={form.meetingType}
                                                onChange={(e) => patch("meetingType", e.target.value)}
                                            >
                                                <option value="online">Online</option>
                                                <option value="offline">Offline</option>
                                            </select>
                                        </div>

                                        <div className="form-field">
                                            <label className="form-label">Meeting Status</label>
                                            <select className="form-input"
                                                value={form.meetingStatus}
                                                onChange={(e) => patch("meetingStatus", e.target.value)}
                                            >
                                                <option value="yet_to_confirm">Yet to Confirm</option>
                                                <option value="confirmed">Confirmed</option>
                                                <option value="cancelled">Cancelled</option>
                                            </select>
                                        </div>

                                    </div>
                                </div>

                                <div className="form-section">
                                    <div className="form-section-title">Attendees</div>

                                    <div className="attendees-container">

                                        {/* AVAILABLE */}
                                        <div className="attendees-box">
                                            <div className="attendees-title">Available</div>

                                            <div className="attendees-list">

                                                {availableUsers.map((user: any) => (
                                                    <div

                                                        key={user.id}

                                                        className={`attendee-item ${selectedAvailable.includes(user.id) ? "active" : ""

                                                            }`}

                                                        onClick={() => {

                                                            setSelectedAvailable((prev: any) =>

                                                                prev.includes(user.id)

                                                                    ? prev.filter((id: any) => id !== user.id)

                                                                    : [...prev, user.id]

                                                            );

                                                        }}
                                                    >

                                                        {user.employeeName}
                                                    </div>

                                                ))}
                                            </div>
                                        </div>

                                        {/* BUTTONS */}
                                        <div className="attendees-actions">
                                            <button onClick={moveToSelected}>→</button>
                                            <button onClick={moveToAvailable}>←</button>
                                        </div>

                                        {/* SELECTED */}
                                        <div className="attendees-box">
                                            <div className="attendees-title">Choosen</div>

                                            <div className="attendees-list">

                                                {selectedUsers.map((user: any) => (
                                                    <div

                                                        key={user.id}

                                                        className={`attendee-item ${selectedChosen.includes(user.id) ? "active" : ""

                                                            }`}

                                                        onClick={() => {

                                                            setSelectedChosen((prev: any) =>

                                                                prev.includes(user.id)

                                                                    ? prev.filter((id: any) => id !== user.id)

                                                                    : [...prev, user.id]

                                                            );

                                                        }}
                                                    >

                                                        {user.employeeName}
                                                    </div>

                                                ))}
                                            </div>
                                        </div>

                                    </div>
                                </div>

                                {/* TRAVEL */}
                                <div className="form-section">
                                    <div className="form-section-title">Travel Details</div>

                                    <div className="form-grid">
                                        <div className="form-field">
                                            <label className="form-label">From</label>
                                            <input className="form-input"
                                                value={form.from}
                                                onChange={(e) => patch("from", e.target.value)}
                                            />
                                        </div>

                                        <div className="form-field">
                                            <label className="form-label">To</label>
                                            <input className="form-input"
                                                value={form.to}
                                                onChange={(e) => patch("to", e.target.value)}
                                            />
                                        </div>

                                        <div className="form-field">
                                            <label className="form-label">Travel Type</label>
                                            <select className="form-input"
                                                value={form.travelType}
                                                onChange={(e) => patch("travelType", e.target.value)}
                                            >
                                                <option value="">Select</option>
                                                <option value="flight">Flight</option>
                                                <option value="train">Train</option>
                                                <option value="bus">Bus</option>
                                                <option value="car">Car</option>
                                            </select>
                                        </div>

                                        <div className="form-field">
                                            <label className="form-label">Vehicle Owner</label>
                                            <input className="form-input"
                                                value={form.vehicleOwner}
                                                onChange={(e) => patch("vehicleOwner", e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>


                                {/* CHECKOUT */}
                                <div className="form-section">
                                    <div className="form-section-title">CheckOut Details</div>

                                    <div className="form-grid">

                                        <div className="form-field">
                                            <label className="form-label">Contact Person</label>
                                            <input className="form-input"
                                                value={form.contactPerson}
                                                onChange={(e) => patch("contactPerson", e.target.value)}
                                            />
                                        </div>

                                        <div className="form-field">
                                            <label className="form-label">Purpose</label>
                                            <input className="form-input"
                                                value={form.purpose}
                                                onChange={(e) => patch("purpose", e.target.value)}
                                            />
                                        </div>

                                        <div className="form-field form-full">
                                            <label className="form-label">Comments</label>
                                            <input className="form-input"
                                                value={form.checkoutComments}
                                                onChange={(e) => patch("checkoutComments", e.target.value)}
                                            />
                                        </div>

                                        <div className="form-field">
                                            <label className="form-label">Next Visit</label>
                                            <input type="date" className="form-input"
                                                value={form.nextVisitDate}
                                                onChange={(e) => patch("nextVisitDate", e.target.value)}
                                            />
                                        </div>

                                        <div className="form-field form-full">
                                            <label className="form-label">Next Action</label>
                                            <textarea className="form-textarea"
                                                value={form.nextAction}
                                                onChange={(e) => patch("nextAction", e.target.value)}
                                            />
                                        </div>

                                    </div>
                                </div></>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="cal-modal-footer">
                            {modal.mode === "view" ? (
                                <>
                                    <button className="btn-outline" onClick={startEdit}>Edit</button>
                                    <button className="btn-danger" onClick={() => deleteEvent(modal.data.id)}>Delete</button>
                                    <button className="btn-outline btn-spacer" onClick={closeModal}>Close</button>
                                </>
                            ) : (
                                <>
                                    <button className="btn-primary" onClick={saveEvent}>
                                        {modal.mode === "create" ? "Save Event" : "Update Event"}
                                    </button>
                                    <button className="btn-outline" onClick={closeModal}>Cancel</button>
                                </>
                            )}
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}
