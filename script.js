// Firebase configuration (replace with your Firebase project config)
const firebaseConfig = {
  apiKey: "AIzaSyBKRzoXYwquXECuww0SXWFNZrdie3lHZ24",
  authDomain: "roster1922.firebaseapp.com",
  projectId: "roster1922",
  storageBucket: "roster1922.firebasestorage.app",
  messagingSenderId: "416706925052",
  appId: "1:416706925052:web:9d429c295e1c3df079a279"
};

// Initialize Firebase
let db;
try {
    const app = firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    console.log('Firestore initialized:', db); // Debug
} catch (error) {
    console.error('Firebase initialization failed:', error);
    showPopup('Failed to connect to database! Using local data.');
}

// Global data storage
let data = {
    pool1: [],
    pool2: [],
    year: new Date().getFullYear(),
    month: 0, // Default to January
    holidays: [],
    unavailable: {},
    roster: {}
};
console.log('Initial data:', data); // Debug

// Reference to summary window
let summaryWindow = null;

// Month names for display
const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

// Load saved data
async function loadData() {
    const year = parseInt(document.getElementById('year').value) || new Date().getFullYear();
    const month = parseInt(document.getElementById('month').value) || 0;

    try {
        // Load pool1, pool2, and holidays from Firestore if available
        if (db) {
            const configDoc = await db.collection('global_config').doc('staff_pools').get();
            if (configDoc.exists) {
                const configData = configDoc.data();
                data.pool1 = configData.pool1 || [];
                data.pool2 = configData.pool2 || [];
                data.holidays = configData.holidays || [];
            } else {
                data.pool1 = [];
                data.pool2 = [];
                data.holidays = [];
            }

            // Set up real-time listener for Firestore updates
            db.collection('global_config').doc('staff_pools').onSnapshot(doc => {
                if (doc.exists) {
                    const configData = doc.data();
                    data.pool1 = configData.pool1 || [];
                    data.pool2 = configData.pool2 || [];
                    data.holidays = configData.holidays || [];
                    document.getElementById('pool1').value = data.pool1.join('\n');
                    document.getElementById('pool2').value = data.pool2.join('\n');
                    document.getElementById('holidays').value = data.holidays.join('\n');
                    renderPage2();
                }
            }, error => {
                console.error('Error in Firestore listener:', error);
                showPopup('Failed to sync data!');
            });
        }

        // Load roster, unavailable, year, and month from localStorage
        const saved = localStorage.getItem('rosterData');
        if (saved) {
            const localData = JSON.parse(saved);
            data.roster = localData.roster || {};
            data.unavailable = localData.unavailable || {};
            data.year = localData.year || year;
            data.month = localData.month || month;
        } else {
            data.roster = {};
            data.unavailable = {};
            data.year = year;
            data.month = month;
        }

        // Update form fields
        document.getElementById('pool1').value = data.pool1.join('\n');
        document.getElementById('pool2').value = data.pool2.join('\n');
        document.getElementById('year').value = data.year;
        document.getElementById('month').value = data.month;
        document.getElementById('holidays').value = data.holidays.join('\n');

        renderPage2();
        updateOfficer();
    } catch (error) {
        console.error('Error loading data:', error);
        showPopup('Failed to load data! Using local data.');
    }
}

// Save data to Firestore and localStorage
async function saveData() {
    try {
        // Save pool1, pool2, and holidays to Firestore if available
        if (db) {
            await db.collection('global_config').doc('staff_pools').set({
                pool1: data.pool1,
                pool2: data.pool2,
                holidays: data.holidays
            });
        }

        // Save all data to localStorage
        localStorage.setItem('rosterData', JSON.stringify(data));
        updateSummaryWindow();
    } catch (error) {
        console.error('Error saving data:', error);
        showPopup('Failed to save data! Saved locally.');
    }
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
        setTimeout(() => popup.remove(), 500);
    }, 2000);
}

// Page navigation with step bar update
function goToPage(pageNum) {
    document.querySelectorAll('.page').forEach(page => page.style.display = 'none');
    document.getElementById(`page${pageNum}`).style.display = 'block';
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

    data.pool1 = document.getElementById('pool1').value.trim().split('\n').filter(name => name.trim());
    data.pool2 = document.getElementById('pool2').value.trim().split('\n').filter(name => name.trim());
    data.holidays = document.getElementById('holidays').value
        .split(/[\n,]+/)
        .map(s => s.trim())
        .filter(s => s);

    if (newYear !== data.year || newMonth !== data.month) {
        data.unavailable = {};
        data.roster = {};
    }

    data.year = newYear;
    data.month = newMonth;

    await saveData();
    renderPage2();
    showPopup('Data saved!');
}

// Page 2: Save roster and unavailable
function savePage2() {
    saveData();
    showPopup('Page 2 data saved!');
}

// Clear only roster data
function clearRoster() {
    data.roster = {};
    saveData();
    renderPage2();
    showPopup('Roster cleared!');
}

// Clear all Page 2 data
function clearAll() {
    data.roster = {};
    data.unavailable = {};
    saveData();
    renderPage2();
    showPopup('Page 2 data cleared!');
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
    console.log('Rendering Page 2 with data:', data); // Debug
    const calendar = document.getElementById('calendar2');
    const alList = document.getElementById('al-list');
    const monthYearDisplay = document.getElementById('page2-month-year');
    if (!calendar || !alList || !monthYearDisplay) {
        console.error('DOM elements missing:', { calendar, alList, monthYearDisplay });
        showPopup('Error: Calendar elements not found!');
        return;
    }

    const { year, month } = data;
    monthYearDisplay.textContent = `${monthNames[month]} ${year}`;
    calendar.innerHTML = '';
    alList.innerHTML = '';

    try {
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay();
        const weeks = Math.ceil((daysInMonth + firstDay) / 7);
        const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        console.log('Calendar params:', { year, month, daysInMonth, firstDay, weeks }); // Debug

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

        renderALList();
        const toggleButton = document.querySelector('.toggle-all-unavailable');
        if (toggleButton) {
            toggleButton.textContent = 'Hide Unavailable';
        }
    } catch (error) {
        console.error('Error rendering Page 2:', error);
        showPopup('Failed to render calendar!');
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
    try {
        if (!data.roster[date]) data.roster[date] = {};
        data.roster[date][shift] = value.trim().split(',').map(s => s.trim()).filter(s => s);
        saveData();
        renderALList();
    } catch (error) {
        console.error('Error updating roster:', error);
        showPopup('Failed to update roster!');
    }
}

// Update unavailability from Page 2
function updateUnavailable(date, type, value) {
    try {
        if (!data.unavailable[date]) data.unavailable[date] = { daytime: [], evening: [], al: [] };
        data.unavailable[date][type] = value.trim().split('\n').filter(name => name.trim());
        saveData();
        renderPage2();
    } catch (error) {
        console.error('Error updating unavailable:', error);
        showPopup('Failed to update unavailable!');
    }
}

// Render AL list
function renderALList() {
    const alList = document.getElementById('al-list');
    let html = '<h3>AL:</h3>';
    let alEntries = [];
    Object.entries(data.unavailable).forEach(([date, unavailable]) => {
        if (unavailable.al && unavailable.al.length > 0) {
            const day = parseInt(date.split('-')[2]);
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
    const allStaff = [...new Set([...data.pool1, ...data.pool2])];
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
            if (day['A2']?.includes(staff)) a++;
            if (day['(A)']?.includes(staff)) a3++;
            if (day['P1']?.includes(staff)) p1++;
            if (day['P2']?.includes(staff)) p2++;
            if (day['N']?.includes(staff)) n++;
            if (d.getDay() === 6) {
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

// Export roster to Excel
function exportToExcel() {
    const { year, month } = data;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const weeks = Math.ceil((daysInMonth + firstDay) / 7);
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    let csvRows = [];
    const headerRow = ['', ...daysOfWeek.map((day, index) => {
        if (day === 'Fri') {
            return ['Fri', '', '', ''];
        }
        return [day, '', ''];
    }).flat(), 'AL'];
    csvRows.push(headerRow.map(cell => `"${cell}"`).join(','));

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

    let currentWeek = 1;
    for (let week = 1; week <= weeks; week++) {
        const weekDates = ['Week ' + week, ...Array(7).map((_, index) => {
            if (index === 5) return ['', '', '', ''];
            return ['', '', ''];
        }).flat()];
        for (let i = 0; i < 7; i++) {
            const dayIndex = (week - 1) * 7 + i - firstDay + 1;
            if (dayIndex >= 1 && dayIndex <= daysInMonth) {
                const colIndex = 1 + (i < 5 ? i * 3 : (i === 5 ? 15 : 19));
                weekDates[colIndex] = `${dayIndex}/${month + 1}`;
                if (i !== 5) {
                    weekDates[colIndex + 1] = '';
                    weekDates[colIndex + 2] = '';
                } else {
                    weekDates[colIndex + 1] = '';
                    weekDates[colIndex + 2] = '';
                    weekDates[colIndex + 3] = '';
                }
            }
        }
        if (week === 1) {
            weekDates[23] = alString;
        }
        csvRows.push(weekDates.map(cell => `"${cell}"`).join(','));

        const nRow = ['N', ...Array(7).map((_, index) => {
            if (index === 5) return ['', '', '', ''];
            return ['', '', ''];
        }).flat()];
        const aRow = ['A', ...Array(7).map((_, index) => {
            if (index === 5) return ['', '', '', ''];
            return ['', '', ''];
        }).flat()];
        const p1Row = ['P1', ...Array(7).map((_, index) => {
            if (index === 5) return ['', '', '', ''];
            return ['', '', ''];
        }).flat()];
        const p2Row = ['P2', ...Array(7).map((_, index) => {
            if (index === 5) return ['', '', '', ''];
            return ['', '', ''];
        }).flat()];
        const unavailableRow = ['Unavailable', ...Array(7).map((_, index) => {
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
            const colIndex = dayOfWeek < 5 ? 1 + dayOfWeek * 3 : (dayOfWeek === 5 ? 16 : 20);

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
                if (dayOfWeek !== 5) {
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
                } else {
                    nRow[colIndex] = (roster['N'] || []).join(', ');
                    nRow[colIndex + 1] = '';
                    nRow[colIndex + 2] = '';
                    nRow[colIndex + 3] = '';
                    aRow[colIndex] = (roster['A'] || []).join(', ');
                    aRow[colIndex + 1] = (roster['A2'] || []).join(', ');
                    aRow[colIndex + 2] = roster['A']?.length || roster['(A)']?.length ? '+' : '';
                    aRow[colIndex + 3] = (roster['(A)'] || []).join(', ');
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

    csvRows.push('');
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

    const csvContent = csvRows.join('\n');
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
    if (data.pool1.length === 0 && data.pool2.length === 0) {
        showPopup('Cannot generate roster: both staff pools are empty!');
        return;
    }

    data.roster = {};
    const { year, month } = data;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const allStaff = [...new Set([...data.pool1, ...data.pool2])];
    let janetAssignmentWarnings = [];

    const saturdayDates = [];
    for (let day = 1; day <= daysInMonth; day++) {
        const date = `${year}-${month + 1}-${day}`;
        if (new Date(year, month, day).getDay() === 6 && !(data.holidays && data.holidays.includes(date))) {
            saturdayDates.push(date);
        }
    }

    let janetSaturdayCount = 0;
    const shuffledSaturdays = saturdayDates.sort(() => Math.random() - 0.5);
    const janet = 'Janet';
    for (let i = 0; i < Math.min(3, shuffledSaturdays.length); i++) {
        const date = shuffledSaturdays[i];
        const unavailable = (data.unavailable[date]?.al || []).map(name => name.toLowerCase());
        if (!unavailable.includes(janet.toLowerCase())) {
            data.roster[date] = { A: [janet], '(A)': [] };
            janetSaturdayCount++;
        }
    }

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
            data.roster[date] = {};
            continue;
        }

        const isSaturday = dayOfWeek === 6;
        const isFriday = dayOfWeek === 5;
        const weekNumber = getWeekNumber(year, month, day);
        const includeA2Shift = isFriday && janetSaturdayWeeks.has(weekNumber);
        const shifts = isSaturday ? ['A', '(A)'] : isFriday && includeA2Shift ? ['N', 'A', 'A2', '(A)', 'P1', 'P2'] : ['N', 'A', '(A)', 'P1', 'P2'];
        if (!data.roster[date]) data.roster[date] = {};

        const unavailableDaytime = (data.unavailable[date]?.daytime || []).map(name => name.toLowerCase());
        const unavailableEvening = (data.unavailable[date]?.evening || []).map(name => name.toLowerCase());
        const unavailableAL = (data.unavailable[date]?.al || []).map(name => name.toLowerCase());

        const prevDate = day > 1 ? `${year}-${month + 1}-${day - 1}` : null;
        const nextDate = day < daysInMonth ? `${year}-${month + 1}-${day + 1}` : null;
        const prevDayShifts = prevDate ? data.roster[prevDate] || {} : {};
        const nextDayShifts = nextDate ? data.roster[nextDate] || {} : {};

        let availablePool1 = data.pool1.filter(s => !unavailableAL.includes(s.toLowerCase()));
        let availablePool2 = data.pool2.filter(s => !unavailableAL.includes(s.toLowerCase()));

        if (dayOfWeek === 5) {
            const satDate = `${year}-${month + 1}-${day + 1}`;
            const satShifts = data.roster[satDate] || {};
            const satStaff = Object.values(satShifts).flat().map(s => s.toLowerCase());
            availablePool1 = availablePool1.filter(s => !satStaff.includes(s.toLowerCase()));
        }
        if (dayOfWeek === 6) {
            const friDate = `${year}-${month + 1}-${day - 1}`;
            const friShifts = data.roster[friDate] || {};
            const friStaff = Object.values(friShifts).flat().map(s => s.toLowerCase());
            availablePool1 = availablePool1.filter(s => !friStaff.includes(s.toLowerCase()));
        }

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

        shifts.forEach(shift => {
            if (data.roster[date][shift]?.length) return;

            let candidates;
            if (shift === 'N') {
                candidates = [...availablePool1, ...availablePool2].filter(s => {
                    if (unavailableEvening.includes(s.toLowerCase())) return false;
                    if (s.toLowerCase() === 'ho') {
                        return dayOfWeek !== 5;
                    }
                    if (s.toLowerCase() === 'ting') {
                        return dayOfWeek === 5;
                    }
                    return true;
                });
            } else if (shift === 'A2') {
                candidates = availablePool1.filter(s => s.toLowerCase() !== janet.toLowerCase() && !unavailableDaytime.includes(s.toLowerCase()));
            } else if (['A', '(A)'].includes(shift)) {
                candidates = availablePool1.filter(s => !unavailableDaytime.includes(s.toLowerCase()));
            } else if (['P1', 'P2'].includes(shift)) {
                candidates = availablePool1.filter(s => !unavailableDaytime.includes(s.toLowerCase()) && !unavailableEvening.includes(s.toLowerCase()));
            } else {
                candidates = availablePool1;
            }

            let prioritizedCandidates = [];
            if (shift === 'P1' || shift === 'P2') {
                prioritizedCandidates = candidates.filter(s => prevDayShifts['N']?.some(ps => ps.toLowerCase() === s.toLowerCase()));
            }
            const finalCandidates = prioritizedCandidates.length > 0 ? prioritizedCandidates : candidates;

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

            if (validCandidates.length > 0) {
                const selected = validCandidates[Math.floor(Math.random() * validCandidates.length)];
                data.roster[date][shift] = [selected];
                if (shift !== 'N' || !data.roster[date]['A']?.some(as => as.toLowerCase() === selected.toLowerCase()) && 
                    !data.roster[date]['(A)']?.some(as => as.toLowerCase() === s.toLowerCase()) && 
                    !data.roster[date]['A2']?.some(as => as.toLowerCase() === s.toLowerCase())) {
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

// Update responsible officer based on month
function updateOfficer() {
    const month = parseInt(document.getElementById('month').value);
    let officer = '';
    switch (month + 1) {
        case 2: case 6: case 10:
            officer = 'Felix';
            break;
        case 1: case 5: case 9:
            officer = 'Sharris';
            break;
        case 4: case 8: case 12:
            officer = 'Mimmy';
            break;
        case 3: case 7: case 11:
            officer = 'Brenda';
            break;
        default:
            officer = 'None';
    }
    document.getElementById('officerName').textContent = officer;
}

// Get duplicate staff for a date
function getDuplicateStaff(date) {
    const roster = data.roster[date] || {};
    const nonNStaff = [
        ...(roster['A'] || []),
        ...(roster['(A)'] || []),
        ...(roster['A2'] || []),
        ...(roster['P1'] || []),
        ...(roster['P2'] || [])
    ].map(name => name.toLowerCase());
    const nStaff = (roster['N'] || []).map(name => name.toLowerCase());

    const duplicates = new Set();
    const seen = new Set();
    nonNStaff.forEach(name => {
        if (seen.has(name)) {
            duplicates.add(name);
        } else {
            seen.add(name);
        }
    });

    const nDuplicates = new Set(nStaff.filter(name => (roster['P1'] || []).concat(roster['P2'] || []).map(n => n.toLowerCase()).includes(name)));
    nDuplicates.forEach(name => duplicates.add(name));

    console.log('Duplicates for', date, ':', duplicates); // Debug
    return duplicates;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing...'); // Debug
    loadData();
    goToPage(1);
    updateOfficer();

    document.getElementById('year').addEventListener('change', updateOfficer);
    document.getElementById('month').addEventListener('change', updateOfficer);

    window.addEventListener('scroll', () => {
        const scrollToTopBtn = document.querySelector('.scroll-to-top');
        if (scrollToTopBtn) {
            if (window.scrollY > 100) {
                scrollToTopBtn.classList.add('show');
            } else {
                scrollToTopBtn.classList.remove('show');
            }
        }
    });
});