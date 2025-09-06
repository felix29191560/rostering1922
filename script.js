// Initialize Firebase
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Global roster ID for shared access
let rosterId = prompt('Enter Roster ID (leave blank for default):') || `${new Date().getFullYear()}_0`;

// Global data storage
let data = {
    pool1: [],
    pool2: [],
    year: new Date().getFullYear(),
    month: 0, // Default to January
    holidays: [],
    unavailablekommer: {}, // { date: { shiftType: [staffNames] } }
};

// Reference to summary window
let summaryWindow = null;

// Month names for display
const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

// Load saved data from Firestore
async function loadData() {
    try {
        const docRef = db.collection('rosters').doc(rosterId);
        const docSnap = await docRef.get();
        const year = parseInt(document.getElementById('year').value) || new Date().getFullYear();
        const month = parseInt(document.getElementById('month').value) || 0;
        if (docSnap.exists) {
            data = docSnap.data();
            document.getElementById('pool1').value = data.pool1.join('\n');
            document.getElementById('pool2').value = data.pool2.join('\n');
            document.getElementById('year').value = data.year;
            document.getElementById('month').value = data.month;
            document.getElementById('holidays').value = (data.holidays || []).join('\n');
        } else {
            // Default data if no document exists
            data = {
                pool1: [],
                pool2: [],
                year: year,
                month: month,
                holidays: [],
                unavailable: {},
                roster: {}
            };
            document.getElementById('month').value = data.month;
        }
        renderPage2();
        updateOfficer();
    } catch (error) {
        console.error('Error loading data:', error);
        showPopup('Failed to load data from Firestore.');
    }
}

// Save data to Firestore
async function saveData() {
    try {
        await db.collection('rosters').doc(rosterId).set(data);
        updateSummaryWindow();
        showPopup('Data saved to Firestore!');
    } catch (error) {
        console.error('Error saving data:', error);
        showPopup('Failed to save data to Firestore.');
    }
}

// Real-time listener for roster updates
function setupRealtimeListener() {
    db.collection('rosters').doc(rosterId).onSnapshot(doc => {
        if (doc.exists) {
            data = doc.data();
            renderPage2();
            updateSummaryWindow();
            showPopup('Roster updated in real-time!');
        }
    }, error => {
        console.error('Error in real-time listener:', error);
        showPopup('Failed to sync roster updates.');
    });
}

// Show pop-up message
function showPopup(message) {
    let popup = document.querySelector('.popup');
    if (!popup) {
        popup = document.createElement('div');
        popup.className = 'popup';
        document.body.appendChild(popup);
    }
    popup.textContent = message;
    popup.classList.add('show');
    setTimeout(() => {
        popup.classList.remove('show');
        setTimeout(() => popup.remove(), 500); // Remove after fade-out
    }, 2000);
}

// Page navigation with step bar update
function goToPage(pageNum) {
    document.querySelectorAll('.page').forEach(page => page.style.display = 'none');
    document.getElementById(`page${pageNum}`).style.display = 'block';
    // Update step bar
    document.querySelectorAll('.step').forEach(step => step.classList.remove('active'));
    document.getElementById(`step${pageNum}`).classList.add('active');
    if (pageNum === 2) renderPage2();
}

// Scroll functions
function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function scrollToBottom() {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
}

// Page 1: Save staff and month
async function savePage1() {
    const newYear = parseInt(document.getElementById('year').value) || new Date().getFullYear();
    const newMonth = parseInt(document.getElementById('month').value) || 0;

    // Update rosterId if year or month changes
    if (newYear !== data.year || newMonth !== data.month) {
        rosterId = prompt('Enter new Roster ID (leave blank for default):') || `${newYear}_${newMonth}`;
        data.unavailable = {};
        data.roster = {};
        setupRealtimeListener(); // Reattach listener for new rosterId
    }

    data.pool1 = document.getElementById('pool1').value.trim().split('\n').filter(name => name.trim());
    data.pool2 = document.getElementById('pool2').value.trim().split('\n').filter(name => name.trim());
    data.year = newYear;
    data.month = newMonth;
    data.holidays = document.getElementById('holidays').value
        .split(/[\n,]+/)
        .map(s => s.trim())
        .filter(s => s);

    await saveData();
    renderPage2();
}

// Get week number for a date
function getWeekNumber(year, month, day) {
    const date = new Date(year, month, day);
    const firstDayOfMonth = new Date(year, month, 1);
    const pastDaysOfMonth = date.getDate();
    const firstDayOfWeek = firstDayOfMonth.getDay();
    return Math.ceil((pastDaysOfMonth + firstDayOfWeek) / 7);
}

// Page 2: Render roster calendar and AL list
function renderPage2() {
    const calendar = document.getElementById('calendar2');
    const alList = document.getElementById('al-list');
    const monthYearDisplay = document.getElementById('page2-month-year');
    const { year, month } = data;
    monthYearDisplay.textContent = `${monthNames[month]} ${year}`;
    calendar.innerHTML = '';
    alList.innerHTML = '';

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const weeks = Math.ceil((daysInMonth + firstDay) / 7);
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let week = 1; week <= weeks; week++) {
        const weekDiv = document.createElement('div');
        weekDiv.className = 'week';
        weekDiv.innerHTML = `<div class="week-label">Week ${week}</div>`;
        const weekRow = document.createElement('div');
        weekRow.className = 'week-row';

        for (let i = 0; i < 7; i++) {
            const dayIndex = (week - 1) * 7 + i - firstDay + 1;
            const div = document.createElement('div');
            div.className = 'day';
            if (dayIndex >= 1 && dayIndex <= daysInMonth) {
                const date = `${year}-${month + 1}-${dayIndex}`;
                const weekday = daysOfWeek[new Date(year, month, dayIndex).getDay()];
                const isSunday = weekday === 'Sun';
                const isSaturday = weekday === 'Sat';
                const isFriday = weekday === 'Fri';
                const isHoliday = data.holidays && data.holidays.includes(date);
                if (isHoliday) div.classList.add('holiday');
                if (isSunday) div.classList.add('sunday');

                // Check for duplicate staff names
                const duplicates = getDuplicateStaff(date);
                const roster = data.roster[date] || {};

                let html = `<div class="day-header${isSunday ? ' sunday' : ''}">${dayIndex} (${weekday})</div>`;
                if (isHoliday) {
                    html += `<div style="color:#d9534f;font-weight:bold;">Holiday</div>`;
                } else if (isSunday) {
                    html += `<div style="color:#d9534f;font-weight:bold;">Sunday</div>`;
                } else {
                    html += `<div class="shifts" style="display:flex;flex-direction:column;gap:4px;">`;
                    if (isSaturday) {
                        const aStyle = roster['A']?.some(name => duplicates.has(name.toLowerCase())) ? 'color:#d9534f;' : '';
                        const a3Style = roster['(A)']?.some(name => duplicates.has(name.toLowerCase())) ? 'color:#d9534f;' : '';
                        html += `<div style="flex:0.5;"><b>A</b>: <input type="text" style="${aStyle}" value="${(roster['A'] || []).join(', ')}" onchange="updateRoster('${date}', 'A', this.value)"></div>`;
                        html += `<div style="flex:0.5;"><b>(A)</b>: <input type="text" style="${a3Style}" value="${(roster['(A)'] || []).join(', ')}" onchange="updateRoster('${date}', '(A)', this.value)"></div>`;
                    } else if (isFriday) {
                        const nStyle = roster['N']?.some(name => duplicates.has(name.toLowerCase())) ? 'color:#d9534f;' : '';
                        const aStyle = roster['A']?.some(name => duplicates.has(name.toLowerCase())) ? 'color:#d9534f;' : '';
                        const a2Style = roster['A2']?.some(name => duplicates.has(name.toLowerCase())) ? 'color:#d9534f;' : '';
                        const a3Style = roster['(A)']?.some(name => duplicates.has(name.toLowerCase())) ? 'color:#d9534f;' : '';
                        const p1Style = roster['P1']?.some(name => duplicates.has(name.toLowerCase())) ? 'color:#d9534f;' : '';
                        const p2Style = roster['P2']?.some(name => duplicates.has(name.toLowerCase())) ? 'color:#d9534f;' : '';
                        html += `<div style="flex:1;"><b>N</b>: <input type="text" style="${nStyle}" value="${(roster['N'] || []).join(', ')}" onchange="updateRoster('${date}', 'N', this.value)"></div>`;
                        html += `<div style="display:flex;gap:4px;">`;
                        html += `<div style="flex:0.33;"><b>A</b>: <input type="text" style="${aStyle}" value="${(roster['A'] || []).join(', ')}" onchange="updateRoster('${date}', 'A', this.value)"></div>`;
                        html += `<div style="flex:0.33;"><b class="a2-label">A</b>: <input type="text" style="${a2Style}" value="${(roster['A2'] || []).join(', ')}" onchange="updateRoster('${date}', 'A2', this.value)"></div>`;
                        html += `<div style="flex:0.33;"><b>(A)</b>: <input type="text" style="${a3Style}" value="${(roster['(A)'] || []).join(', ')}" onchange="updateRoster('${date}', '(A)', this.value)"></div>`;
                        html += `</div>`;
                        html += `<div style="flex:1;"><b>P1</b>: <input type="text" style="${p1Style}" value="${(roster['P1'] || []).join(', ')}" onchange="updateRoster('${date}', 'P1', this.value)"></div>`;
                        html += `<div style="flex:1;"><b>P2</b>: <input type="text" style="${p2Style}" value="${(roster['P2'] || []).join(', ')}" onchange="updateRoster('${date}', 'P2', this.value)"></div>`;
                    } else {
                        const nStyle = roster['N']?.some(name => duplicates.has(name.toLowerCase())) ? 'color:#d9534f;' : '';
                        const aStyle = roster['A']?.some(name => duplicates.has(name.toLowerCase())) ? 'color:#d9534f;' : '';
                        const a3Style = roster['(A)']?.some(name => duplicates.has(name.toLowerCase())) ? 'color:#d9534f;' : '';
                        const p1Style = roster['P1']?.some(name => duplicates.has(name.toLowerCase())) ? 'color:#d9534f;' : '';
                        const p2Style = roster['P2']?.some(name => duplicates.has(name.toLowerCase())) ? 'color:#d9534f;' : '';
                        html += `<div style="flex:1;"><b>N</b>: <input type="text" style="${nStyle}" value="${(roster['N'] || []).join(', ')}" onchange="updateRoster('${date}', 'N', this.value)"></div>`;
                        html += `<div style="display:flex;gap:4px;">`;
                        html += `<div style="flex:0.5;"><b>A</b>: <input type="text" style="${aStyle}" value="${(roster['A'] || []).join(', ')}" onchange="updateRoster('${date}', 'A', this.value)"></div>`;
                        html += `<div style="flex:0.5;"><b>(A)</b>: <input type="text" style="${a3Style}" value="${(roster['(A)'] || []).join(', ')}" onchange="updateRoster('${date}', '(A)', this.value)"></div>`;
                        html += `</div>`;
                        html += `<div style="flex:1;"><b>P1</b>: <input type="text" style="${p1Style}" value="${(roster['P1'] || []).join(', ')}" onchange="updateRoster('${date}', 'P1', this.value)"></div>`;
                        html += `<div style="flex:1;"><b>P2</b>: <input type="text" style="${p2Style}" value="${(roster['P2'] || []).join(', ')}" onchange="updateRoster('${date}', 'P2', this.value)"></div>`;
                    }
                    html += `</div>`;
                    // Unavailability section (visible by default)
                    html += `<div class="unavailable">`;
                    html += `<div>Unavailable(Daytime): <textarea class="unavailable-input" rows="2" onchange="updateUnavailable('${date}', 'daytime', this.value)">${(data.unavailable[date]?.daytime || []).join('\n')}</textarea></div>`;
                    html += `<div>Unavailable(Evening): <textarea class="unavailable-input" rows="2" onchange="updateUnavailable('${date}', 'evening', this.value)">${(data.unavailable[date]?.evening || []).join('\n')}</textarea></div>`;
                    html += `<div>AL: <textarea class="unavailable-input" rows="2" onchange="updateUnavailable('${date}', 'al', this.value)">${(data.unavailable[date]?.al || []).join('\n')}</textarea></div>`;
                    html += `</div>`;
                }
                div.innerHTML = html;
            }
            weekRow.appendChild(div);
        }
        weekDiv.appendChild(weekRow);
        calendar.appendChild(weekDiv);
    }

    // Render AL list
    renderALList();

    // Ensure toggle button reflects default visible state
    const toggleButton = document.querySelector('.toggle-all-unavailable');
    if (toggleButton) {
        toggleButton.textContent = 'Hide Unavailable';
    }
}

// Toggle all unavailability sections visibility
function toggleAllUnavailable() {
    const unavailableSections = document.querySelectorAll('#calendar2 .unavailable');
    const button = document.querySelector('.toggle-all-unavailable');
    const allVisible = Array.from(unavailableSections).every(section => section.style.display !== 'none');

    unavailableSections.forEach(section => {
        section.style.display = allVisible ? 'none' : 'block';
    });

    button.textContent = allVisible ? 'Show Unavailable' : 'Hide Unavailable';
}

// Update roster data
function updateRoster(date, shift, value) {
    if (!data.roster[date]) data.roster[date] = {};
    data.roster[date][shift] = value.trim().split(',').map(s => s.trim()).filter(s => s);
    saveData();
    renderALList();
}

// Update unavailability from Page 2
function updateUnavailable(date, type, value) {
    if (!data.unavailable[date]) data.unavailable[date] = { daytime: [], evening: [], al: [] };
    data.unavailable[date][type] = value.trim().split('\n').filter(name => name.trim());
    saveData();
    renderPage2();
}

// Render AL list (show only day of month)
function renderALList() {
    const alList = document.getElementById('al-list');
    let html = '<h3>AL:</h3>';
    let alEntries = [];
    Object.entries(data.unavailable).forEach(([date, unavailable]) => {
        if (unavailable.al && unavailable.al.length > 0) {
            const day = parseInt(date.split('-')[2]); // Extract day only
            unavailable.al.forEach(staff => {
                let staffEntry = alEntries.find(entry => entry.staff === staff);
                if (!staffEntry) {
                    staffEntry = { staff, days: [] };
                    alEntries.push(staffEntry);
                }
                staffEntry.days.push(day);
            });
        }
    });
    if (alEntries.length === 0) {
        html += '<p>No AL recorded</p>';
    } else {
        alEntries.forEach(entry => {
            html += `<p>${entry.staff}: ${entry.days.join(', ')}</p>`;
        });
    }
    alList.innerHTML = html;
}

// Generate summary table HTML
function generateSummaryTable() {
    const allStaff = [...new Set([...data.pool1, ...data.pool2])]; // Combine and remove duplicates
    let html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Summary Table</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 20px;
                    background-color: #f4f4f4;
                }
                .summary-window {
                    padding: 20px;
                    background: white;
                    margin: auto;
                    border-radius: 8px;
                    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
                    overflow-x: auto;
                }
                .summary-window h2 {
                    margin-top: 0;
                    color: #333;
                }
                .summary-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 14px;
                }
                .summary-table th, .summary-table td {
                    border: 1px solid #ccc;
                    padding: 8px;
                    text-align: center;
                    white-space: nowrap;
                }
                .summary-table th:first-child, .summary-table td:first-child {
                    position: sticky;
                    left: 0;
                    background: #fff;
                    z-index: 1;
                    border-right: 2px solid #ccc;
                }
            </style>
        </head>
        <body>
            <div class="summary-window">
                <h2>Summary</h2>
                <label style="font-style: italic;">*Real Time Update</label>
                <table class="summary-table">
                    <tr>
                        <th>Staff</th>
                        <th>A</th>
                        <th>(A)</th>
                        <th>P1</th>
                        <th>P2</th>
                        <th>N</th>
                        <th>Sat</th>
                        <th>A+P1</th>
                        <th>(A)+P2</th>
                        <th>N+Sat</th>
                        <th>Total</th>
                    </tr>
    `;

    allStaff.forEach(staff => {
        let a = 0, a3 = 0, p1 = 0, p2 = 0, n = 0, sat = 0;
        Object.entries(data.roster).forEach(([date, day]) => {
            const d = new Date(date);
            if (day['A']?.includes(staff)) a++;
            if (day['A2']?.includes(staff)) a++; // Combine A2 with A
            if (day['(A)']?.includes(staff)) a3++;
            if (day['P1']?.includes(staff)) p1++;
            if (day['P2']?.includes(staff)) p2++;
            if (day['N']?.includes(staff)) n++;
            if (d.getDay() === 6) { // Saturday
                if (Object.values(day).some(arr => arr?.includes(staff))) sat++;
            }
        });
        const aPlusP1 = a + p1;
        const a3PlusP2 = a3 + p2;
        const nPlusSat = n + sat;
        const total = a + a3 + p1 + p2 + n;
        html += `<tr><td>${staff}</td><td>${a}</td><td>${a3}</td><td>${p1}</td><td>${p2}</td><td>${n}</td><td>${sat}</td><td>${aPlusP1}</td><td>${a3PlusP2}</td><td>${nPlusSat}</td><td>${total}</td></tr>`;
    });

    html += `
                </table>
            </div>
        </body>
        </html>
    `;

    return html;
}

// Show or update summary table in a new window
function showSummary() {
    if (!summaryWindow || summaryWindow.closed) {
        summaryWindow = window.open('', 'SummaryTable', 'width=900,height=600');
    }
    summaryWindow.document.write(generateSummaryTable());
    summaryWindow.document.close();
    summaryWindow.focus();
}

// Update summary window if open
function updateSummaryWindow() {
    if (summaryWindow && !summaryWindow.closed) {
        summaryWindow.document.write(generateSummaryTable());
        summaryWindow.document.close();
    }
}

// Export roster to CSV
function exportToExcel() {
    const { year, month } = data;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const weeks = Math.ceil((daysInMonth + firstDay) / 7);
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Initialize CSV data
    let csvRows = [];

    // Header row: Empty, Day names (spanning three columns each, except Fri uses four: Q-T), AL
    const headerRow = ['', ...daysOfWeek.map((day, index) => {
        if (day === 'Fri') {
            return ['Fri', '', '', '']; // Four columns for Friday (Q-T)
        }
        return [day, '', '']; // Three columns for other days
    }).flat(), 'AL'];
    csvRows.push(headerRow.map(cell => `"${cell}"`).join(','));

    // Collect AL entries
    const alEntries = [];
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${month + 1}-${day}`;
        if (data.unavailable[dateStr]?.al?.length > 0) {
            const dayNum = parseInt(dateStr.split('-')[2]);
            data.unavailable[dateStr].al.forEach(staff => {
                let staffEntry = alEntries.find(entry => entry.staff === staff);
                if (!staffEntry) {
                    staffEntry = { staff, days: [] };
                    alEntries.push(staffEntry);
                }
                staffEntry.days.push(dayNum);
            });
        }
    }
    const alString = alEntries.length > 0 ? alEntries.map(entry => `${entry.staff}: ${entry.days.join(', ')}`).join('; ') : 'No AL recorded';

    // Week data
    let currentWeek = 1;
    for (let week = 1; week <= weeks; week++) {
        // Week dates row
        const weekDates = ['Week ' + week, ...Array(7).fill().map((_, index) => {
            if (index === 5) return ['', '', '', '']; // Four columns for Friday
            return ['', '', '']; // Three columns for other days
        }).flat()];
        for (let i = 0; i < 7; i++) {
            const dayIndex = (week - 1) * 7 + i - firstDay + 1;
            if (dayIndex >= 1 && dayIndex <= daysInMonth) {
                const colIndex = 1 + (i < 5 ? i * 3 : (i === 5 ? 15 : 19)); // Fri: Q=16, Sat: U=20
                weekDates[colIndex] = `${dayIndex}/${month + 1}`;
                if (i !== 5) {
                    weekDates[colIndex + 1] = ''; // Empty for non-Friday
                    weekDates[colIndex + 2] = ''; // Empty for non-Friday
                } else {
                    weekDates[colIndex + 1] = ''; // Empty for Friday (Q+1=R)
                    weekDates[colIndex + 2] = ''; // Empty for Friday (Q+2=S)
                    weekDates[colIndex + 3] = ''; // Empty for Friday (Q+3=T)
                }
            }
        }
        if (week === 1) {
            weekDates[23] = alString; // Column X for AL
        }
        csvRows.push(weekDates.map(cell => `"${cell}"`).join(','));

        // Shift rows (N, A, P1, P2, Unavailable)
        const nRow = ['N', ...Array(7).fill().map((_, index) => {
            if (index === 5) return ['', '', '', ''];
            return ['', '', ''];
        }).flat()];
        const aRow = ['A', ...Array(7).fill().map((_, index) => {
            if (index === 5) return ['', '', '', ''];
            return ['', '', ''];
        }).flat()];
        const p1Row = ['P1', ...Array(7).fill().map((_, index) => {
            if (index === 5) return ['', '', '', ''];
            return ['', '', ''];
        }).flat()];
        const p2Row = ['P2', ...Array(7).fill().map((_, index) => {
            if (index === 5) return ['', '', '', ''];
            return ['', '', ''];
        }).flat()];
        const unavailableRow = ['Unavailable', ...Array(7).fill().map((_, index) => {
            if (index === 5) return ['', '', '', ''];
            return ['', '', ''];
        }).flat()];

        for (let day = 1; day <= daysInMonth; day++) {
            const date = `${year}-${month + 1}-${day}`;
            const dateObj = new Date(year, month, day);
            const dayOfWeek = dateObj.getDay();
            const weekNum = getWeekNumber(year, month, day);
            if (weekNum !== currentWeek) continue;

            const isHoliday = data.holidays && data.holidays.includes(date);
            const isSunday = dayOfWeek === 0;
            const colIndex = dayOfWeek < 5 ? 1 + dayOfWeek * 3 : (dayOfWeek === 5 ? 16 : 20); // Fri: Q=16, Sat: U=20

            if (isHoliday || isSunday) {
                if (isHoliday) {
                    if (dayOfWeek !== 5) {
                        nRow[colIndex] = 'Holiday';
                        nRow[colIndex + 1] = '';
                        nRow[colIndex + 2] = '';
                        aRow[colIndex] = 'Holiday';
                        aRow[colIndex + 1] = '';
                        aRow[colIndex + 2] = '';
                        p1Row[colIndex] = 'Holiday';
                        p1Row[colIndex + 1] = '';
                        p1Row[colIndex + 2] = '';
                        p2Row[colIndex] = 'Holiday';
                        p2Row[colIndex + 1] = '';
                        p2Row[colIndex + 2] = '';
                        unavailableRow[colIndex] = 'Holiday';
                        unavailableRow[colIndex + 1] = '';
                        unavailableRow[colIndex + 2] = '';
                    } else {
                        nRow[colIndex] = 'Holiday';
                        nRow[colIndex + 1] = '';
                        nRow[colIndex + 2] = '';
                        nRow[colIndex + 3] = '';
                        aRow[colIndex] = 'Holiday';
                        aRow[colIndex + 1] = '';
                        aRow[colIndex + 2] = '';
                        aRow[colIndex + 3] = '';
                        p1Row[colIndex] = 'Holiday';
                        p1Row[colIndex + 1] = '';
                        p1Row[colIndex + 2] = '';
                        p1Row[colIndex + 3] = '';
                        p2Row[colIndex] = 'Holiday';
                        p2Row[colIndex + 1] = '';
                        p2Row[colIndex + 2] = '';
                        p2Row[colIndex + 3] = '';
                        unavailableRow[colIndex] = 'Holiday';
                        unavailableRow[colIndex + 1] = '';
                        unavailableRow[colIndex + 2] = '';
                        unavailableRow[colIndex + 3] = '';
                    }
                }
            } else {
                const roster = data.roster[date] || {};
                if (dayOfWeek !== 5) { // Non-Friday
                    nRow[colIndex] = (roster['N'] || []).join(', ');
                    nRow[colIndex + 1] = '';
                    nRow[colIndex + 2] = '';
                    aRow[colIndex] = ([...(roster['A'] || []), ...(roster['A2'] || [])]).join(', ');
                    aRow[colIndex + 1] = roster['A']?.length || roster['(A)']?.length ? '+' : '';
                    aRow[colIndex + 2] = (roster['(A)'] || []).join(', ');
                    p1Row[colIndex] = (roster['P1'] || []).join(', ');
                    p1Row[colIndex + 1] = '';
                    p1Row[colIndex + 2] = '';
                    p2Row[colIndex] = (roster['P2'] || []).join(', ');
                    p2Row[colIndex + 1] = '';
                    p2Row[colIndex + 2] = '';
                    const unavailable = [...new Set([...(data.unavailable[date]?.daytime || []), ...(data.unavailable[date]?.evening || [])])].join(', ');
                    unavailableRow[colIndex] = unavailable;
                    unavailableRow[colIndex + 1] = '';
                    unavailableRow[colIndex + 2] = '';
                } else { // Friday (Q=16, R=17, S=18, T=19)
                    nRow[colIndex] = (roster['N'] || []).join(', ');
                    nRow[colIndex + 1] = '';
                    nRow[colIndex + 2] = '';
                    nRow[colIndex + 3] = '';
                    aRow[colIndex] = (roster['A'] || []).join(', '); // Q: A shift
                    aRow[colIndex + 1] = (roster['A2'] || []).join(', '); // R: A2 shift
                    aRow[colIndex + 2] = roster['A']?.length || roster['(A)']?.length ? '+' : ''; // S: +
                    aRow[colIndex + 3] = (roster['(A)'] || []).join(', '); // T: (A) shift
                    p1Row[colIndex] = (roster['P1'] || []).join(', ');
                    p1Row[colIndex + 1] = '';
                    p1Row[colIndex + 2] = '';
                    p1Row[colIndex + 3] = '';
                    p2Row[colIndex] = (roster['P2'] || []).join(', ');
                    p2Row[colIndex + 1] = '';
                    p2Row[colIndex + 2] = '';
                    p2Row[colIndex + 3] = '';
                    const unavailable = [...new Set([...(data.unavailable[date]?.daytime || []), ...(data.unavailable[date]?.evening || [])])].join(', ');
                    unavailableRow[colIndex] = unavailable;
                    unavailableRow[colIndex + 1] = '';
                    unavailableRow[colIndex + 2] = '';
                    unavailableRow[colIndex + 3] = '';
                }
            }
        }

        csvRows.push(
            nRow.map(cell => `"${cell}"`).join(','),
            aRow.map(cell => `"${cell}"`).join(','),
            p1Row.map(cell => `"${cell}"`).join(','),
            p2Row.map(cell => `"${cell}"`).join(','),
            unavailableRow.map(cell => `"${cell}"`).join(',')
        );
        currentWeek++;
    }

    // Empty row before criteria
    csvRows.push('');

    // Assignment criteria
    const criteria = [
        'Assignment Criteria:',
        '1. No staff works both Friday and Saturday in the same week.',
        '2. Staff with N-shift yesterday are prioritized for P1 or P2 today.',
        '3. Ho can do N-shift except on Fridays.',
        '4. Ting can only do N-shift on Fridays.',
        '5. If Janet works Saturday A-shift, include A2 shift on Friday of the same week.',
        '6. Janet is excluded from A2 shift.',
        '7. Janet must be assigned exactly 3 Saturday A-shifts if available, else A or P1.',
        '8. A staff cannot be assigned to both N and P1/P2 shifts on the same day unless they are already assigned to A/(A)/A2.',
        '9. Unavailable groups: Daytime (A, A2, (A), P1, P2), Evening (N, P1, P2), AL (all shifts).'
    ];
    criteria.forEach(criterion => {
        csvRows.push(`"${criterion}"`);
    });

    // Combine rows into CSV content
    const csvContent = csvRows.join('\n');

    // Create and download the CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Roster_${monthNames[month]}_${year}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showPopup('CSV file exported!');
}

// Generate roster
function generateRoster() {
    data.roster = {};
    const { year, month } = data;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const allStaff = [...new Set([...data.pool1, ...data.pool2])]; // Combine and remove duplicates
    let janetAssignmentWarnings = [];

    // Identify Saturdays for Janet's A shift assignment
    const saturdayDates = [];
    for (let day = 1; day <= daysInMonth; day++) {
        const date = `${year}-${month + 1}-${day}`;
        if (new Date(year, month, day).getDay() === 6 && !(data.holidays && data.holidays.includes(date))) {
            saturdayDates.push(date);
        }
    }

    // Ensure Janet gets exactly 3 Saturday A shifts
    let janetSaturdayCount = 0;
    const shuffledSaturdays = saturdayDates.sort(() => Math.random() - 0.5); // Shuffle for random selection
    const janet = 'Janet';
    for (let i = 0; i < Math.min(3, shuffledSaturdays.length); i++) {
        const date = shuffledSaturdays[i];
        const unavailable = (data.unavailable[date]?.al || []).map(name => name.toLowerCase());
        if (!unavailable.includes(janet.toLowerCase())) {
            data.roster[date] = { A: [janet], '(A)': [] };
            janetSaturdayCount++;
        }
    }

    // Track weeks where Janet has Saturday A shifts
    const janetSaturdayWeeks = new Set();
    for (let date of saturdayDates) {
        if (data.roster[date]?.A?.includes(janet)) {
            const week = getWeekNumber(year, month, parseInt(date.split('-')[2]));
            janetSaturdayWeeks.add(week);
        }
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const date = `${year}-${month + 1}-${day}`;
        const dayOfWeek = new Date(year, month, day).getDay();
        const isHoliday = data.holidays && data.holidays.includes(date);
        if (isHoliday || dayOfWeek === 0) {
            data.roster[date] = {}; // No shifts on holidays or Sundays
            continue;
        }

        const isSaturday = dayOfWeek === 6;
        const isFriday = dayOfWeek === 5;
        const weekNumber = getWeekNumber(year, month, day);
        const includeA2Shift = isFriday && janetSaturdayWeeks.has(weekNumber);
        const shifts = isSaturday ? ['A', '(A)'] : isFriday && includeA2Shift ? ['N', 'A', 'A2', '(A)', 'P1', 'P2'] : ['N', 'A', '(A)', 'P1', 'P2'];
        if (!data.roster[date]) data.roster[date] = {};

        // Get unavailable staff for this date (case-insensitive)
        const unavailableDaytime = (data.unavailable[date]?.daytime || []).map(name => name.toLowerCase());
        const unavailableEvening = (data.unavailable[date]?.evening || []).map(name => name.toLowerCase());
        const unavailableAL = (data.unavailable[date]?.al || []).map(name => name.toLowerCase());

        // Get staff assigned on previous and next day
        const prevDate = day > 1 ? `${year}-${month + 1}-${day - 1}` : null;
        const nextDate = day < daysInMonth ? `${year}-${month + 1}-${day + 1}` : null;
        const prevDayShifts = prevDate ? data.roster[prevDate] || {} : {};
        const nextDayShifts = nextDate ? data.roster[nextDate] || {} : {};

        // Available staff (case-insensitive filtering)
        let availablePool1 = data.pool1.filter(s => !unavailableAL.includes(s.toLowerCase()));
        let availablePool2 = data.pool2.filter(s => !unavailableAL.includes(s.toLowerCase()));

        // Check Friday-Saturday constraint
        if (dayOfWeek === 5) { // Friday
            const satDate = `${year}-${month + 1}-${day + 1}`;
            const satShifts = data.roster[satDate] || {};
            const satStaff = Object.values(satShifts).flat().map(s => s.toLowerCase());
            availablePool1 = availablePool1.filter(s => !satStaff.includes(s.toLowerCase()));
        }
        if (dayOfWeek === 6) { // Saturday
            const friDate = `${year}-${month + 1}-${day - 1}`;
            const friShifts = data.roster[friDate] || {};
            const friStaff = Object.values(friShifts).flat().map(s => s.toLowerCase());
            availablePool1 = availablePool1.filter(s => !friStaff.includes(s.toLowerCase()));
        }

        // Ensure Janet gets A or P1 shift (except A2) if available and not already assigned 3 Saturday A shifts
        let janetAssigned = data.roster[date]?.A?.includes(janet) || false;
        const isJanetAvailable = (availablePool1.includes(janet) || availablePool2.includes(janet)) && !unavailableAL.includes(janet.toLowerCase());
        let janetShifts = isSaturday ? ['A'] : ['A', 'P1'];
        if (isJanetAvailable && !janetAssigned && janetShifts.length > 0 && (!isSaturday || janetSaturdayCount < 3)) {
            const availableJanetShifts = janetShifts.filter(shift => {
                if (shift === 'P1' && (unavailableEvening.includes(janet.toLowerCase()) || unavailableDaytime.includes(janet.toLowerCase()))) return false;
                return !data.roster[date][shift]?.length;
            });
            if (availableJanetShifts.length > 0) {
                const randomShift = availableJanetShifts[Math.floor(Math.random() * availableJanetShifts.length)];
                data.roster[date][randomShift] = [janet];
                if (randomShift === 'A' && isSaturday) janetSaturdayCount++;
                janetAssigned = true;
                availablePool1 = availablePool1.filter(s => s.toLowerCase() !== janet.toLowerCase());
                availablePool2 = availablePool2.filter(s => s.toLowerCase() !== janet.toLowerCase());
            } else if (!isSaturday) {
                janetAssignmentWarnings.push(`Could not assign Janet to A or P1 on ${date} due to shift conflicts or unavailability.`);
            }
        }

        // Assign remaining shifts, prioritizing staff with N-shift yesterday for P1/P2
        shifts.forEach(shift => {
            if (data.roster[date][shift]?.length) return; // Skip if already assigned

            let candidates;
            if (shift === 'N') {
                candidates = [...availablePool1, ...availablePool2].filter(s => {
                    if (unavailableEvening.includes(s.toLowerCase())) return false;
                    if (s.toLowerCase() === 'ho') {
                        // Ho can do N shift except Friday
                        return dayOfWeek !== 5;
                    }
                    if (s.toLowerCase() === 'ting') {
                        // Ting can do N shift only on Friday
                        return dayOfWeek === 5;
                    }
                    return true;
                });
            } else if (shift === 'A2') {
                // Exclude Janet from A2 shift
                candidates = availablePool1.filter(s => s.toLowerCase() !== janet.toLowerCase() && !unavailableDaytime.includes(s.toLowerCase()));
            } else if (['A', '(A)'].includes(shift)) {
                candidates = availablePool1.filter(s => !unavailableDaytime.includes(s.toLowerCase()));
            } else if (['P1', 'P2'].includes(shift)) {
                candidates = availablePool1.filter(s => !unavailableDaytime.includes(s.toLowerCase()) && !unavailableEvening.includes(s.toLowerCase()));
            } else {
                candidates = availablePool1;
            }

            // Prioritize staff who had N-shift yesterday for P1 or P2
            let prioritizedCandidates = [];
            if (shift === 'P1' || shift === 'P2') {
                prioritizedCandidates = candidates.filter(s => prevDayShifts['N']?.some(ps => ps.toLowerCase() === s.toLowerCase()));
            }
            const finalCandidates = prioritizedCandidates.length > 0 ? prioritizedCandidates : candidates;

            // Filter candidates based on constraints
            const validCandidates = finalCandidates.filter(s => {
                const assignedShifts = data.roster[date] ? Object.values(data.roster[date]).flat() : [];
                if (assignedShifts.some(as => as.toLowerCase() === s.toLowerCase())) {
                    return (data.roster[date]['A']?.some(as => as.toLowerCase() === s.toLowerCase()) ||
                            data.roster[date]['(A)']?.some(as => as.toLowerCase() === s.toLowerCase()) ||
                            data.roster[date]['A2']?.some(as => as.toLowerCase() === s.toLowerCase())) && shift === 'N';
                }
                if ((shift === 'P1' || shift === 'P2') && data.roster[date]['N']?.some(ns => ns.toLowerCase() === s.toLowerCase())) {
                    return false;
                }
                return true;
            });

            // Randomly select a staff member
            if (validCandidates.length > 0) {
                const selected = validCandidates[Math.floor(Math.random() * validCandidates.length)];
                data.roster[date][shift] = [selected];
                if (shift !== 'N' || !data.roster[date]['A']?.some(as => as.toLowerCase() === selected.toLowerCase()) &&
                    !data.roster[date]['(A)']?.some(as => as.toLowerCase() === selected.toLowerCase()) &&
                    !data.roster[date]['A2']?.some(as => as.toLowerCase() === selected.toLowerCase())) {
                    availablePool1 = availablePool1.filter(s => s.toLowerCase() !== selected.toLowerCase());
                    availablePool2 = availablePool2.filter(s => s.toLowerCase() !== selected.toLowerCase());
                }
            } else {
                data.roster[date][shift] = [];
            }
        });
    }

    renderPage2();
    saveData();
    if (janetAssignmentWarnings.length > 0) {
        showPopup(`Roster generated with warnings:\n${janetAssignmentWarnings.join('\n')}`);
    } else {
        showPopup('Roster generated!');
    }
}

// Clear only Page 2 data (roster and unavailable staff)
async function clearAll() {
    data.roster = {};
    data.unavailable = {};
    await saveData();
    renderPage2();
    showPopup('Page 2 data cleared in Firestore!');
}

// Clear roster shifts only
async function clearRoster() {
    data.roster = {};
    await saveData();
    renderPage2();
    showPopup('Roster shifts cleared!');
}

// Update officer based on month
function updateOfficer() {
    const month = parseInt(document.getElementById('month').value);
    let officer = '';

    // Map months to officers (month values are 0-based: 0=Jan, 1=Feb, ..., 11=Dec)
    switch (month + 1) { // Add 1 to convert to 1-based month numbers
        case 2: // February
        case 6: // June
        case 10: // October
            officer = 'Felix';
            break;
        case 1: // January
        case 5: // May
        case 9: // September
            officer = 'Sharris';
            break;
        case 4: // April
        case 8: // August
        case 12: // December
            officer = 'Mimmy';
            break;
        case 3: // March
        case 7: // July
        case 11: // November
            officer = 'Brenda';
            break;
        default:
            officer = 'None';
    }

    document.getElementById('officerName').textContent = officer;
}

// Check for duplicate staff assignments
function getDuplicateStaff(date) {
    const roster = data.roster[date] || {};
    // Combine staff from A, (A), A2, P1, P2 for duplicate checking
    const nonNStaff = [
        ...(roster['A'] || []),
        ...(roster['(A)'] || []),
        ...(roster['A2'] || []),
        ...(roster['P1'] || []),
        ...(roster['P2'] || [])
    ].map(name => name.toLowerCase()); // Case-insensitive comparison
    const nStaff = (roster['N'] || []).map(name => name.toLowerCase());

    // Find duplicates within A, (A), A2, P1, P2
    const duplicates = new Set();
    const seen = new Set();
    nonNStaff.forEach(name => {
        if (seen.has(name)) {
            duplicates.add(name);
        } else {
            seen.add(name);
        }
    });

    // Include duplicates between N and P1/P2 (but not N with A/(A)/A2)
    const nDuplicates = new Set(nStaff.filter(name => (roster['P1'] || []).concat(roster['P2'] || []).map(n => n.toLowerCase()).includes(name)));
    nDuplicates.forEach(name => duplicates.add(name));

    return duplicates; // Returns lowercase names that are duplicated (excluding N with A/(A)/A2)
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    auth.signInAnonymously().then(() => {
        console.log('User signed in anonymously');
        loadData();
        setupRealtimeListener();
    }).catch(error => {
        console.error('Authentication error:', error);
        showPopup('Failed to authenticate.');
    });

    goToPage(1); // Set step1 as active on load
    document.getElementById('year').addEventListener('change', updateOfficer);
    document.getElementById('month').addEventListener('change', updateOfficer);

    // Add scroll event listener for scroll-to-top icon
    window.addEventListener('scroll', () => {
        const scrollToTopBtn = document.querySelector('.scroll-to-top');
        if (scrollToTopBtn) {
            if (window.scrollY > 100) { // Show when scrolled down 100px
                scrollToTopBtn.classList.add('show');
            } else {
                scrollToTopBtn.classList.remove('show');
            }
        }
    });
});