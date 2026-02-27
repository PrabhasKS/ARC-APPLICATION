// Helper functions for time calculation and date filtering

const toMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const parts = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!parts) return 0;

    let hours = parseInt(parts[1], 10);
    const minutes = parseInt(parts[2], 10);
    const modifier = parts[3] ? parts[3].toUpperCase() : null;

    if (modifier === 'PM' && hours < 12) {
        hours += 12;
    } else if (modifier === 'AM' && hours === 12) {
        hours = 0;
    }
    return hours * 60 + minutes;
};

const parseTimeTo24Hour = (timeStr) => {
    if (!timeStr) return null;
    const parts = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!parts) return null;

    let hours = parseInt(parts[1], 10);
    const minutes = parseInt(parts[2], 10);
    const modifier = parts[3] ? parts[3].toUpperCase() : null;

    if (modifier === 'PM' && hours < 12) {
        hours += 12;
    } else if (modifier === 'AM' && hours === 12) {
        hours = 0;
    }
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const formatTo12Hour = (time24hStr) => {
    if (!time24hStr) return '';
    let [hours, minutes] = time24hStr.split(':').map(Number);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    minutes = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${minutes} ${ampm}`;
};

const checkOverlap = (startA, endA, startB, endB) => {
    const startAMin = toMinutes(startA);
    const endAMin = toMinutes(endA);
    const startBMin = toMinutes(startB);
    const endBMin = toMinutes(endB);

    return startAMin < endBMin && endAMin > startBMin;
};

// Helper to build date filter clauses and params
const buildDateFilter = (columnName, startDate, endDate, isDateTime = false) => {
    let filterSql = '';
    let queryParams = [];

    if (startDate && endDate) {
        if (startDate === endDate) {
            // For a single day
            if (isDateTime) {
                filterSql = ` AND ${columnName} >= ? AND ${columnName} < DATE_ADD(?, INTERVAL 1 DAY)`;
                queryParams.push(startDate, startDate);
            } else { // Assuming DATE type
                filterSql = ` AND ${columnName} = ?`;
                queryParams.push(startDate);
            }
        } else {
            // For a date range
            if (isDateTime) {
                // For DATETIME columns, BETWEEN treats endDate as midnight (00:00:00),
                // which excludes all records after midnight on the last day.
                // Use >= start AND < end+1day to capture the full last day.
                filterSql = ` AND ${columnName} >= ? AND ${columnName} < DATE_ADD(?, INTERVAL 1 DAY)`;
                queryParams.push(startDate, endDate);
            } else {
                filterSql = ` AND ${columnName} BETWEEN ? AND ?`;
                queryParams.push(startDate, endDate);
            }
        }
    }
    return { filterSql, queryParams };
};

module.exports = {
    toMinutes,
    parseTimeTo24Hour,
    formatTo12Hour,
    checkOverlap,
    buildDateFilter
};
