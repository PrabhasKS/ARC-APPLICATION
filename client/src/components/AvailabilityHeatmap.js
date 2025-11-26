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
                return '#a3d9a5'; // Darker Green
            case 'partial':
                return '#ffe082'; // Darker Yellow
            case 'membership':
                return '#ffd700'; // Gold for Membership
            case 'booked':
            case 'full':
                return '#f0a1a8'; // Darker Red
            case 'maintenance':
            case 'under-maintenance':
                return '#c0c1c2'; // Darker Grey
            default:
                return '#f7f7a8'; // Darker lightyellow for other cases
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
                <div style={{ position: 'fixed', top: tooltip.y + 10, left: tooltip.x + 10, backgroundColor: 'white', border: '1px solid #ccc', padding: '10px', zIndex: 1000, pointerEvents: 'none' }}>
                    {tooltip.content}
                </div>
            )}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr>
                        <th style={{ minWidth: '150px', padding: '8px', border: '1px solid #ddd' }}>Court</th>
                        {timeSlots.map(time => (
                            <th key={time} style={{ padding: '8px', border: '1px solid #ddd' }}>{time}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {heatmapData.map(court => (
                        <tr key={court.id}>
                            <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>{court.name} ({court.sport_name})</td>
                            {court.slots.map(slot => (
                                <td key={slot.time} style={{ padding: 0, border: '1px solid #ddd', textAlign: 'center' }}>
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
                                                        border: '1px solid black',
                                                        cursor: subSlot.availability === 'available' || subSlot.availability === 'partial' ? 'pointer' : 'not-allowed'
                                                    }}
                                                    onClick={() => (subSlot.availability === 'available' || subSlot.availability === 'partial') && onSlotSelect(court, slot.time, index * 30)}
                                                    onMouseEnter={(e) => handleMouseEnter(e, subSlot)}
                                                    onMouseLeave={handleMouseLeave}
                                                >
                                                    {subSlot.availability === 'partial' ? `${court.capacity - totalSlotsBooked}/${court.capacity}` : ''}
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
