import React, { useState } from 'react';

const AvailabilityHeatmap = ({ heatmapData, onSlotSelect }) => {
    const [tooltip, setTooltip] = useState({ visible: false, content: null, x: 0, y: 0 });

    if (!heatmapData || heatmapData.length === 0) {
        return <p>Loading availability...</p>;
    }

    const timeSlots = heatmapData[0]?.slots.map(slot => slot.time) || [];

    const getCellColor = (availability) => {
        switch (availability) {
            case 'available':
                return '#98f69bff'; // Light green
            case 'partial':
                return 'rgba(255, 232, 160, 1)'; // Light yellow
            case 'attended':
                return '#fee497ff'; // Light yellow
            case 'booked':
            case 'full':
                return '#fdacb3ff'; // Light red
            case 'maintenance':
            case 'under-maintenance':
                return '#d0d2d3'; // Light gray
            default:
                return '#ffe8a0'; // Light yellow fallback
        }
    };

    const handleMouseEnter = (e, subSlot) => {
        if (subSlot.booking) {
            const content = (
                <div>
                    {subSlot.booking.map(b => (
                        <div key={b.id}>
                            <p><strong>Booking ID:</strong> {b.id}</p>
                            <p><strong>Customer:</strong> {b.customer_name}</p>
                            <p><strong>Time:</strong> {b.time_slot}</p>
                            <p><strong>Slots Booked:</strong> {b.slots_booked}</p>
                        </div>
                    ))}
                </div>
            );
            setTooltip({ visible: true, content, x: e.clientX, y: e.clientY });
        }
    };

    const handleMouseLeave = () => {
        setTooltip({ visible: false, content: null, x: 0, y: 0 });
    };

    return (
        <div style={{ overflowX: 'auto', position: 'relative' }}>
            <h3>Court Availability Heatmap</h3>
            {tooltip.visible && (
                <div style={{ position: 'fixed', top: tooltip.y + 10, left: tooltip.x + 10, backgroundColor: '#fff', border: '1px solid #D5D8DC', borderRadius: '8px', padding: '12px 16px', zIndex: 1000, pointerEvents: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.12)', fontSize: '13px' }}>
                    {tooltip.content}
                </div>
            )}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr>
                        <th style={{ minWidth: '150px', padding: '10px 12px', border: '1px solid #2E5A99', backgroundColor: '#1B3A6B', color: '#fff', fontWeight: '600', fontSize: '13px', letterSpacing: '0.5px' }}>Court</th>
                        {timeSlots.map(time => (
                            <th key={time} style={{ padding: '10px 8px', border: '1px solid #2E5A99', backgroundColor: '#1B3A6B', color: '#fff', fontWeight: '600', fontSize: '12px', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{time}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {heatmapData.map(court => (
                        <tr key={court.id}>
                            <td style={{ padding: '10px 12px', border: '1px solid #E8EAED', fontWeight: '600', fontSize: '13px', color: '#1B3A6B', backgroundColor: '#F8F9FA', whiteSpace: 'nowrap' }}>{court.name} ({court.sport_name})</td>
                            {court.slots.map(slot => (
                                <td key={slot.time} style={{ padding: 0, border: '1px solid #E8EAED', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', height: '100%' }}>
                                        {slot.subSlots.map((subSlot, index) => {
                                            const totalSlotsBooked = subSlot.booking ? subSlot.booking.reduce((acc, b) => acc + (Number(b.slots_booked) || 0), 0) : 0;
                                            return (
                                                <div
                                                    key={index}
                                                    style={{
                                                        backgroundColor: getCellColor(subSlot.availability),
                                                        width: '50%',
                                                        height: '40px',
                                                        border: '1px solid rgba(27,58,107,0.3)',
                                                        cursor: subSlot.availability === 'available' || subSlot.availability === 'partial' ? 'pointer' : 'not-allowed',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '10px',
                                                        fontWeight: '600',
                                                        color: '#1B3A6B',
                                                        overflow: 'hidden',
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                    onClick={() => (subSlot.availability === 'available' || subSlot.availability === 'partial') && onSlotSelect(court, slot.time, index * 30)}
                                                    onMouseEnter={(e) => handleMouseEnter(e, subSlot)}
                                                    onMouseLeave={handleMouseLeave}
                                                >
                                                    {subSlot.availability === 'partial' ? `${court.capacity - totalSlotsBooked}` : ''}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default AvailabilityHeatmap;
