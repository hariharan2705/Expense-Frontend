import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import "./Events.css";
import api from "../../lib/api";

export default function EventDetail() {
    const { id } = useParams();
    const [search, setSearch] = useState("");
    const [events, setEvents] = useState<any[]>([]);
    const [loadingId, setLoadingId] = useState<string | null>(null);

    function processEvents(events: any) {
        return events.map((event: any, index: any) => {
            // Check if all previous events are completed
            const previousCompleted = events
                .slice(0, index)
                .every((e) => e.is_checked_out);

            return {
                ...event,
                canCheckIn: previousCompleted && !event.is_checked_in,
                canCheckOut: event.is_checked_in && !event.is_checked_out,
            };
        });
    }
    const fetchEvents = async () => {
        try {
            const response = await api.get("api/events/get-events-by-date",
                { params: { date: id } }
            );
            if (response?.data?.status == 'success') {
                setEvents(processEvents(response.data.data || []));
            }
            console.log(response, 'oooooo')

        } catch (error) {
            console.error("Error fetching events:", error);
        }
    };
    useEffect(() => {
        fetchEvents();
    }, []);


    const updateCheckIn = async (id: string) => {
        try {
            setLoadingId(id);

            const response = await api.post("/api/events/update-check-in", { id });

            if (response?.data?.status === "success") {
                fetchEvents();
            }

        } catch (error) {
            console.error(error);
        } finally {
            setLoadingId(null);
        }
    };

    const updateCheckOut = async (id: string) => {
        try {
            setLoadingId(id);

            const response = await api.post("/api/events/update-check-out", {
                id,
            });

            if (response?.data?.status === "success") {
                fetchEvents(); // refresh UI
            } else {
                console.log(response?.data?.message);
            }

        } catch (error: any) {
            console.error("Check-out failed:", error?.response?.data || error.message);
        } finally {
            setLoadingId(null);
        }
    };




    function formatDateTime(dateStr: string): string {
        const date = new Date(dateStr);

        return date.toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
        });
    }

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
                    {events.map((e: any, i: any) => (
                        <div key={i} className="event-card">

                            <div className="event-title">{e.title}</div>

                            <div className="event-info">
                                <p><b>Account:</b></p>
                                <p><b>Subject:</b> {e.subject || " "}</p>

                                <p>
                                    <b>Start:</b> {formatDateTime(e.start_date_time)}
                                </p>

                                <p>
                                    <b>End:</b> {formatDateTime(e.end_date_time)}
                                </p>
                            </div>
                            {(e?.is_checked_in && e?.is_checked_out)
                                ? <div className="event-actions">
                                    <p className="btn-checkin">
                                        Completed
                                    </p>
                                </div>
                                :
                                <div className="event-actions">
                                    <button
                                        className="btn-checkin"
                                        disabled={!e.canCheckIn || loadingId === e.id}
                                        onClick={() => updateCheckIn(e.id)}
                                    >
                                        {loadingId === e.id
                                            ? "Checking..."
                                            : e?.is_checked_in
                                                ? "Checked In"
                                                : "Check In"}
                                    </button>

                                    <button
                                        className="btn-checkout"
                                        disabled={!e.canCheckOut || loadingId === e.id}
                                        onClick={() => updateCheckOut(e.id)}
                                    >

                                        {loadingId === e.id
                                            ? "Checking Out..."
                                            : e?.is_checked_out
                                                ? "Checked Out"
                                                : "Check Out"}
                                    </button>
                                </div>
                            }

                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}