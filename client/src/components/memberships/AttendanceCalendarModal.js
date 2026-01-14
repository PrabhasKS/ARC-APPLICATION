import React, { useRef } from 'react';
import './AttendanceCalendarModal.css';

const AttendanceCalendarModal = ({ membership, attendanceHistory, leaveHistory = [], onClose }) => {
    const modalRef = useRef();

    // Helper to generate calendar data for a specific month
    const generateMonthData = (year, month) => {
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startDayOfWeek = firstDay.getDay(); // 0 = Sunday

        const days = [];
        // Empty slots for days before the 1st
        for (let i = 0; i < startDayOfWeek; i++) {
            days.push(null);
        }
        // Days of the month
        for (let i = 1; i <= daysInMonth; i++) {
            days.push(new Date(year, month, i));
        }
        return days;
    };

    // Determine status of a day
    const getDayStatus = (date) => {
        if (!date) return 'empty';
        
        const dateStr = date.toISOString().slice(0, 10);
        const todayStr = new Date().toISOString().slice(0, 10);
        const startDateStr = new Date(membership.start_date).toISOString().slice(0, 10);
        const endDateStr = new Date(membership.current_end_date).toISOString().slice(0, 10);

        // Before membership start
        if (dateStr < startDateStr) return 'disabled';
        
        // After membership end
        if (dateStr > endDateStr) return 'disabled';

        // Check if on leave
        const isOnLeave = leaveHistory.some(leave => {
            const start = new Date(leave.start_date).toISOString().slice(0, 10);
            const end = new Date(leave.end_date).toISOString().slice(0, 10);
            return dateStr >= start && dateStr <= end;
        });
        if (isOnLeave) return 'leave';

        // Check if present
        if (attendanceHistory.includes(dateStr)) return 'present';

        // Check if today
        if (dateStr === todayStr) return 'today';

        // Past dates that are not present are 'absent' (or just missed)
        if (dateStr < todayStr) return 'absent';

        // Future dates
        return 'future';
    };

    // Generate months covering the membership duration
    const getMonthsToDisplay = () => {
        const start = new Date(membership.start_date);
        const end = new Date(membership.current_end_date);
        const months = [];
        
        let current = new Date(start.getFullYear(), start.getMonth(), 1);
        const endDate = new Date(end.getFullYear(), end.getMonth(), 1);

        while (current <= endDate) {
            months.push(new Date(current));
            current.setMonth(current.getMonth() + 1);
        }
        return months;
    };

    const handlePrint = () => {
        window.print();
    };

    const months = getMonthsToDisplay();
    const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    return (
        <div className="attendance-calendar-modal-overlay" onClick={onClose}>
            <div className="attendance-calendar-modal" onClick={e => e.stopPropagation()} ref={modalRef}>
                <div className="calendar-header">
                    <div>
                        <h3>Attendance Record: {membership.package_name}</h3>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
                            {membership.team_members} <br/>
                            {new Date(membership.start_date).toLocaleDateString()} - {new Date(membership.current_end_date).toLocaleDateString()} ({membership.time_slot})
                        </p>
                    </div>
                    <div className="calendar-controls">
                        <button className="btn btn-secondary" onClick={handlePrint}>Print</button>
                        <button className="btn btn-danger" onClick={onClose}>Close</button>
                    </div>
                </div>

                <div className="calendar-grid-container">
                    {months.map((monthDate, idx) => {
                        const days = generateMonthData(monthDate.getFullYear(), monthDate.getMonth());
                        return (
                            <div key={idx} className="calendar-month">
                                <div className="month-title">
                                    {monthDate.toLocaleDateString('default', { month: 'long', year: 'numeric' })}
                                </div>
                                <div className="days-grid">
                                    {dayNames.map(d => <div key={d} className="day-cell header">{d}</div>)}
                                    {days.map((date, i) => {
                                        const status = date ? getDayStatus(date) : 'empty';
                                        return (
                                            <div 
                                                key={i} 
                                                className={`day-cell ${status}`}
                                                title={date ? `${date.toLocaleDateString()}: ${status}` : ''}
                                            >
                                                {date ? date.getDate() : ''}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="calendar-legend">
                    <div className="legend-item">
                        <div className="legend-color" style={{ backgroundColor: '#d4edda' }}></div> Present
                    </div>
                    <div className="legend-item">
                        <div className="legend-color" style={{ backgroundColor: '#fff3cd' }}></div> Leave
                    </div>
                    <div className="legend-item">
                        <div className="legend-color" style={{ backgroundColor: '#f8d7da' }}></div> Absent/Past
                    </div>
                    <div className="legend-item">
                        <div className="legend-color" style={{ backgroundColor: '#fff', border: '1px solid #ccc' }}></div> Future
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AttendanceCalendarModal;
