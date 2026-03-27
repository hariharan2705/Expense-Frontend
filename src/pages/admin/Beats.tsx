import React, { useState } from "react";
import "./Beats.css";
import { useNavigate } from "react-router-dom";

const data = [
    "SENTHIL B2026-03-26",
    "Hari2026-03-01",
    "SENTHIL B2026-03-27",
    "SENTHIL B2026-03-20",
    "SENTHIL B2026-02-14",
    "Pushparaj2026-03-20",
];



export default function Beats() {
    const [search, setSearch] = useState("");
    const navigate = useNavigate();

    const filtered = data.filter(item =>
        item.toLowerCase().includes(search.toLowerCase())
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
                            onClick={() => navigate(`/admin/beats/${item}`)}
                        >
                            <input type="checkbox" onClick={(e) => e.stopPropagation()} />
                            <span className="sf-link">{item}</span>
                            <span className="sf-menu">⋯</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}