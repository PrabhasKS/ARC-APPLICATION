import React, { useState, useEffect, useMemo } from 'react';
import './AvailabilityHeatmap.css';

const AvailabilityHeatmap = ({ heatmapData, onSlotSelect }) => {
    const [tooltip, setTooltip] = useState({ visible: false, content: null, x: 0, y: 0 });
    const [currentTime, setCurrentTime] = useState(new Date());
    const [currentSportIndex, setCurrentSportIndex] = useState(0);

    // Update current time every minute for the red line
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // Get unique sports
    const uniqueSports = useMemo(() => {
        if (!heatmapData || heatmapData.length === 0) return [];
        const sports = new Set(heatmapData.map(court => court.sport_name));
        return Array.from(sports);
    }, [heatmapData]);

    // Handle initial state if sports load dynamically
    useEffect(() => {
        if (uniqueSports.length > 0 && currentSportIndex >= uniqueSports.length) {
            setCurrentSportIndex(0);
        }
    }, [uniqueSports, currentSportIndex]);

    const activeSport = uniqueSports[currentSportIndex];

    // Filter courts by active sport
    const activeCourts = useMemo(() => {
        if (!heatmapData || !activeSport) return [];
        return heatmapData.filter(court => court.sport_name === activeSport);
    }, [heatmapData, activeSport]);

    if (!heatmapData || heatmapData.length === 0) {
        return (
            <div style={{ padding: '20px', textAlign: 'center', color: '#6C757D' }}>
                Loading availability...
            </div>
        );
    }

    const handleMouseEnter = (e, subSlot) => {
        if (subSlot.booking && subSlot.booking.length > 0) {
            const content = (
                <div className="heatmap-tooltip">
                    <h4>Booking Details</h4>
                    {subSlot.booking.map(b => (
                        <div key={b.id} className="heatmap-tooltip-booking">
                            <p><strong>ID:</strong> <span>#{b.id}</span></p>
                            <p><strong>Customer:</strong> <span>{b.customer_name}</span></p>
                            <p><strong>Time:</strong> <span>{b.time_slot}</span></p>
                            <p><strong>Courts Booked:</strong> <span>{b.slots_booked}</span></p>
                        </div>
                    ))}
                </div>
            );
            // Offset slightly so cursor doesn't block it
            setTooltip({ visible: true, content, x: e.clientX + 15, y: e.clientY + 15 });
        }
    };

    const handleMouseLeave = () => {
        setTooltip({ visible: false, content: null, x: 0, y: 0 });
    };

    // Navigation handlers
    const handlePrevSport = () => {
        setCurrentSportIndex(prev => (prev > 0 ? prev - 1 : uniqueSports.length - 1));
    };

    const handleNextSport = () => {
        setCurrentSportIndex(prev => (prev < uniqueSports.length - 1 ? prev + 1 : 0));
    };

    // Prepare rows from timeSlots
    const rows = [];
    const referenceCourt = activeCourts.length > 0 ? activeCourts[0] : heatmapData[0];
    
    if (referenceCourt?.slots) {
        referenceCourt.slots.forEach((slot) => {
            // First 30 mins
            rows.push({ timeLabel: slot.time, timeVal: slot.time, subIndex: 0, isHourStart: true });
            // Second 30 mins
            rows.push({ timeLabel: "", timeVal: slot.time, subIndex: 1, isHourStart: false });
        });
    }

    // Calculate red line position
    let redLineTop = null;
    if (rows.length > 0) {
        const firstTimeVal = rows[0].timeVal; // e.g., "05:00"
        const timeParts = firstTimeVal.split(':');
        
        // Ensure parsing works for normal format (05:00)
        if (timeParts.length >= 2) {
            let startHour = parseInt(timeParts[0], 10);
            
            // Adjust for PM if it's 12-hour format "05:00 PM"
            if (firstTimeVal.toLowerCase().includes('pm') && startHour < 12) {
                startHour += 12;
            } else if (firstTimeVal.toLowerCase().includes('am') && startHour === 12) {
                startHour = 0;
            }

            const currentHour = currentTime.getHours();
            const currentMin = currentTime.getMinutes();
            
            // Fixed header height (padding + borders + text height)
            const headerHeight = 65; 

            if (currentHour >= startHour) {
                const hoursDiff = currentHour - startHour;
                // 90px per hour
                const calculatedTop = headerHeight + (hoursDiff * 90) + (currentMin / 60) * 90;
                
                // Only show if it's within the rendered slots
                // Number of hours = rows.length / 2
                const totalHours = rows.length / 2;
                if (hoursDiff < totalHours) {
                    redLineTop = calculatedTop;
                }
            }
        }
    }

    return (
        <div style={{ position: 'relative' }}>
            <div className="heatmap-header-controls">
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#1B3A6B' }}>
                    Court Availability Heatmap
                </h3>
                
                {uniqueSports.length > 1 && (
                    <div className="sport-navigation">
                        <button onClick={handlePrevSport} className="nav-btn">&lt;</button>
                        <span className="current-sport-label">{activeSport}</span>
                        <button onClick={handleNextSport} className="nav-btn">&gt;</button>
                    </div>
                )}
            </div>

            <div className="heatmap-legend">
                <div className="legend-item">
                    <span className="legend-color" style={{ backgroundColor: 'rgba(40, 167, 69, 0.15)', border: '1px solid rgba(40, 167, 69, 0.3)' }}></span>
                    Available
                </div>
                <div className="legend-item">
                    <span className="legend-color" style={{ backgroundColor: 'rgba(255, 193, 7, 0.2)', border: '1px solid rgba(255, 193, 7, 0.4)' }}></span>
                    Active Membership / Partial
                </div>
                <div className="legend-item">
                    <span className="legend-color" style={{ backgroundColor: 'rgba(220, 53, 69, 0.15)', border: '1px solid rgba(220, 53, 69, 0.3)' }}></span>
                    Booked
                </div>
                <div className="legend-item">
                    <span className="legend-color" style={{ backgroundColor: '#E9ECEF', border: '1px solid #DEE2E6' }}></span>
                    Maintenance / Unbookable
                </div>
            </div>
            
            {tooltip.visible && (
                <div style={{ position: 'fixed', top: tooltip.y, left: tooltip.x, zIndex: 1000, pointerEvents: 'none' }}>
                    {tooltip.content}
                </div>
            )}

            <div className="heatmap-container">
                {redLineTop !== null && (
                    <div className="heatmap-current-time-line" style={{ top: `${redLineTop}px` }}>
                        <div className="time-line-dot"></div>
                    </div>
                )}

                <div className="heatmap-grid" style={{ '--court-count': activeCourts.length }}>
                    {/* --- Header Row --- */}
                    <div className="heatmap-time-header"></div>
                    {activeCourts.map((court) => (
                        <div key={`header-${court.id}`} className="heatmap-court-header">
                            <span className="heatmap-court-name">{court.name}</span>
                            <span className="heatmap-sport-name">{court.sport_name}</span>
                        </div>
                    ))}

                    {/* --- Body Rows --- */}
                    {rows.map((row, rowIndex) => (
                        <React.Fragment key={`row-${rowIndex}`}>
                            {/* Time Axis Cell */}
                            <div className={`heatmap-time-cell ${row.isHourStart ? 'hour-boundary' : 'half-hour'}`}>
                                {row.isHourStart && (
                                    <span className="time-label">{row.timeLabel}</span>
                                )}
                            </div>

                            {/* Court Cells */}
                            {activeCourts.map((court) => {
                                const slotData = court.slots.find(s => s.time === row.timeVal);
                                const subSlot = slotData ? slotData.subSlots[row.subIndex] : null;

                                if (!subSlot) {
                                    return <div key={`empty-${court.id}-${rowIndex}`} className="heatmap-slot-cell" />;
                                }

                                const totalSlotsBooked = subSlot.booking ? subSlot.booking.reduce((acc, b) => acc + (Number(b.slots_booked) || 0), 0) : 0;
                                
                                let statusClass = 'status-maintenance';
                                let content = '';
                                
                                // Determine styling based on availability
                                switch(subSlot.availability) {
                                    case 'available':
                                        statusClass = 'status-available-empty'; 
                                        break;
                                    case 'partial':
                                        statusClass = 'status-partial';
                                        content = `${court.capacity - totalSlotsBooked} Left`;
                                        break;
                                    case 'attended':
                                        statusClass = 'status-attended';
                                        content = 'Membership';
                                        break;
                                    case 'booked':
                                    case 'full':
                                        statusClass = 'status-booked';
                                        break;
                                    case 'maintenance':
                                    case 'under-maintenance':
                                        statusClass = 'status-maintenance';
                                        break;
                                    default:
                                        statusClass = 'status-maintenance';
                                        break;
                                }

                                const isClickable = subSlot.availability === 'available' || subSlot.availability === 'partial';

                                return (
                                    <div
                                        key={`${court.id}-${row.timeVal}-${row.subIndex}`}
                                        className={`heatmap-slot-cell ${!row.isHourStart ? 'hour-boundary' : ''} ${!isClickable ? 'not-allowed' : ''}`}
                                        onClick={() => isClickable && onSlotSelect(court, row.timeVal, row.subIndex * 30)}
                                        onMouseEnter={(e) => handleMouseEnter(e, subSlot)}
                                        onMouseLeave={handleMouseLeave}
                                    >
                                        <div className={`heatmap-block ${statusClass} ${isClickable ? 'clickable' : ''}`}>
                                            {content}
                                        </div>
                                    </div>
                                );
                            })}
                        </React.Fragment>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AvailabilityHeatmap;
