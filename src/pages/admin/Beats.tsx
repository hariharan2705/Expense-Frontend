import React, { useEffect, useState } from "react";
import "./Beats.css";
import { useNavigate } from "react-router-dom";
import api from "../../lib/api";

const data = [
    "SENTHIL B2026-03-26",
    "Hari2026-03-01",
    "SENTHIL B2026-03-27",
    "SENTHIL B2026-03-20",
    "SENTHIL B2026-02-14",
    "Pushparaj2026-03-20",
];

interface Event {
    start_date_time: string;
    name: string;
    event_counts: string;
    display_name: string;
}

export default function Beats() {
    const [search, setSearch] = useState("");
    const [events, setEvents] = useState<Event[]>([]);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                const response = await api.get("api/events/get-event-counts-by-each-date");
                if (response?.data?.status == 'success') {
                    setEvents(response.data.data);
                }
                console.log(response, 'oooooo')

            } catch (error) {
                console.error("Error fetching events:", error);
            }
        };

        fetchEvents();
    }, []);


    const filtered = events.filter(item =>
        item.display_name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="sf-container">

            {/* HEADER */}
            <div className="sf-header">
                <div>
                    <div className="sf-title">Recently Viewed</div>
                    <div className="sf-sub">16 items • Updated 8 minutes ago</div>
                </div>

                <div className="sf-actions">
                    <button>New</button>
                    <button>Import</button>
                    <button>Change Owner</button>
                    <button>Assign Label</button>
                </div>
            </div>

            {/* SEARCH */}
            <div className="sf-search">
                <input
                    placeholder="Search this list..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {/* TABLE */}
            <div className="sf-table">
                <div className="sf-row sf-head">
                    <input type="checkbox" />
                    <span>Parent Event Name</span>
                </div>

                <div className="sf-body">
                    {filtered.map((item, i) => (
                        <div
                            key={i}
                            className="sf-row"
                            // onClick={() => navigate(`/admin/beats/${item?.display_name}`)}
                            onClick={() => navigate(`/app/beats/${item?.display_name?.split(" ")[0]}`)}
                        >
                            <input type="checkbox" onClick={(e) => e.stopPropagation()} />
                            <span className="sf-link">{item?.display_name || " "}</span>
                            <span className="sf-menu">⋯</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}