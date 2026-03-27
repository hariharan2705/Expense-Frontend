import React from "react";
import { useParams } from "react-router-dom";
import "./Events.css";

export default function EventDetail() {
    const { id } = useParams();

    const events = [
        {
            title: "Meeting",
            start: "Thu, Mar 26, 2026, 02:00 PM",
            end: "Thu, Mar 26, 2026, 03:00 PM",
        },
        {
            title: "Meeting",
            start: "Thu, Mar 26, 2026, 03:00 PM",
            end: "Thu, Mar 26, 2026, 04:00 PM",
        },
    ];

    return (
        <div className="detail-page">

            {/* HEADER */}
            <div className="detail-header">
                <div className="icon">🟢</div>
                <div>
                    <div className="label">Beat</div>
                    <div className="title">{id}</div>
                </div>
            </div>

            {/* ACTION BAR */}
            <div className="action-bar">
                <button className="btn-start">Start Job</button>
                <button className="btn-stop">Stop Job</button>
            </div>

            {/* SECTION */}
            <div className="section">
                <h3>Related Events</h3>

                <div className="event-grid">
                    {events.map((e, i) => (
                        <div key={i} className="event-card">

                            <div className="event-title">{e.title}</div>

                            <div className="event-info">
                                <p><b>Account:</b> —</p>
                                <p><b>Company:</b> —</p>
                                <p><b>Start:</b> {e.start}</p>
                                <p><b>End:</b> {e.end}</p>
                            </div>

                            <div className="event-actions">
                                <button className="btn-checkin">Check In</button>
                                <button className="btn-checkout">Check Out</button>
                            </div>

                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}