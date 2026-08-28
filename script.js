let dataset = null;
let allClasses = []; 
let uniqueFaculties = new Set();
let uniqueRooms = new Set();

let appMode = 'student'; // 'student' or 'faculty'
let searchMode = 'faculty'; // 'faculty' or 'room'

let selection = { course: null, department: null, semester: null, section: null, day: null, half: null };

const els = {
    studentView: document.getElementById('student-view'), facultyView: document.getElementById('faculty-view'),
    courseGrp: document.getElementById('course-group'), courseBtns: document.getElementById('course-buttons'),
    deptGrp: document.getElementById('dept-group'), deptBtns: document.getElementById('dept-buttons'),
    semGrp: document.getElementById('sem-group'), semBtns: document.getElementById('sem-buttons'),
    secGrp: document.getElementById('sec-group'), secBtns: document.getElementById('sec-buttons'),
    dayGrp: document.getElementById('day-group'), halfGrp: document.getElementById('half-group'),
    searchInput: document.getElementById('search-input'), searchDatalist: document.getElementById('search-datalist'),
    searchLabel: document.getElementById('search-label'),
    routineResults: document.getElementById('routine-results'), liveStatus: document.getElementById('live-status'),
    currentClass: document.getElementById('current-class-content'), nextClass: document.getElementById('next-class-content')
};

document.addEventListener('DOMContentLoaded', () => {
    fetch('./data/timetable.json')
        .then(response => response.json())
        .then(data => {
            dataset = data.schedule; 
            buildGlobalIndexes();
            createButtons(Object.keys(dataset), els.courseBtns, 'course');
        })
        .catch(err => console.error("Error loading timetable:", err));

    setupListeners();
    setInterval(updateLiveStatus, 60000);
});

// Build Indexes for Faculty/Room Search
function buildGlobalIndexes() {
    allClasses = [];
    uniqueFaculties = new Set();
    uniqueRooms = new Set();

    for (const course in dataset) {
        for (const dept in dataset[course]) {
            for (const sem in dataset[course][dept]) {
                const semObj = dataset[course][dept][sem];
                if (semObj.sections) {
                    for (const sec in semObj.sections) extractClasses(semObj.sections[sec], course, dept, sem, sec);
                } else if (semObj.days) {
                    extractClasses(semObj.days, course, dept, sem, null);
                }
            }
        }
    }
}

function extractClasses(daysObj, course, dept, sem, sec) {
    for (const day in daysObj) {
        daysObj[day].forEach(cls => {
            allClasses.push({ ...cls, course, dept, sem, sec, day });
            
            if (cls.faculty) {
                cls.faculty.forEach(fStr => {
                    fStr.split(',').forEach(f => {
                        const cleanF = f.trim();
                        if (cleanF) uniqueFaculties.add(cleanF);
                    });
                });
            }
            if (cls.room) uniqueRooms.add(cls.room.trim());
        });
    }
}

function populateDatalist() {
    els.searchDatalist.innerHTML = '';
    const items = searchMode === 'faculty' ? [...uniqueFaculties].sort() : [...uniqueRooms].sort();
    items.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item;
        els.searchDatalist.appendChild(opt);
    });
    els.searchInput.value = '';
    els.searchInput.placeholder = searchMode === 'faculty' ? 'Type faculty initials...' : 'Type room number...';
    els.searchLabel.textContent = searchMode === 'faculty' ? 'Select Faculty' : 'Select Room/Lab';
}

// UI Generation
function createButtons(items, container, type) {
    container.innerHTML = '';
    items.forEach(item => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.dataset.type = type;
        btn.dataset.value = item;
        btn.textContent = item;
        container.appendChild(btn);
    });
}

function handleSelection(type, value, buttonEl) {
    const container = buttonEl.parentElement;
    container.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
    buttonEl.classList.add('selected');

    if (type === 'course') {
        selection.course = value;
        resetFrom('department');
        createButtons(Object.keys(dataset[value]), els.deptBtns, 'department');
        els.deptGrp.classList.remove('hidden');
    } else if (type === 'department') {
        selection.department = value;
        resetFrom('semester');
        createButtons(Object.keys(dataset[selection.course][value]), els.semBtns, 'semester');
        els.semGrp.classList.remove('hidden');
    } else if (type === 'semester') {
        selection.semester = value;
        resetFrom('section');
        const semData = dataset[selection.course][selection.department][value];
        if (semData.sections) {
            createButtons(Object.keys(semData.sections), els.secBtns, 'section');
            els.secGrp.classList.remove('hidden');
        } else {
            selection.section = null;
            els.secGrp.classList.add('hidden');
            els.dayGrp.classList.remove('hidden');
        }
    } else if (type === 'section') {
        selection.section = value;
        resetFrom('day');
        els.dayGrp.classList.remove('hidden');
    } else if (type === 'fac-mode') {
        searchMode = value;
        populateDatalist();
        els.dayGrp.classList.add('hidden');
        clearResults();
    } else if (type === 'day') {
        selection.day = value;
        selection.half = null; 
        els.halfGrp.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
        els.halfGrp.classList.remove('hidden');
        renderRoutine();
    } else if (type === 'half') {
        selection.half = value;
        renderRoutine();
    }
}

function resetFrom(level) {
    const levels = ['department', 'semester', 'section', 'day', 'half'];
    const idx = levels.indexOf(level);
    
    for (let i = idx; i < levels.length; i++) {
        selection[levels[i]] = null;
        if (levels[i] === 'department') els.deptGrp.classList.add('hidden');
        if (levels[i] === 'semester') els.semGrp.classList.add('hidden');
        if (levels[i] === 'section') els.secGrp.classList.add('hidden');
        if (levels[i] === 'day') {
            els.dayGrp.classList.add('hidden');
            els.dayGrp.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
        }
        if (levels[i] === 'half') {
            els.halfGrp.classList.add('hidden');
            els.halfGrp.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
        }
    }
    clearResults();
}

function setupListeners() {
    // Mode Switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('selected'));
            e.target.classList.add('selected');
            appMode = e.target.dataset.mode;
            
            if (appMode === 'student') {
                els.studentView.classList.remove('hidden');
                els.facultyView.classList.add('hidden');
                resetFrom('course');
                els.courseGrp.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
            } else {
                els.studentView.classList.add('hidden');
                els.facultyView.classList.remove('hidden');
                populateDatalist();
                els.dayGrp.classList.add('hidden');
                els.halfGrp.classList.add('hidden');
            }
            clearResults();
        });
    });

    // Options Clicks
    document.querySelector('.options-panel').addEventListener('click', (e) => {
        if (e.target.classList.contains('option-btn')) {
            handleSelection(e.target.dataset.type, e.target.dataset.value, e.target);
        }
    });

    // Search Input
    els.searchInput.addEventListener('change', () => {
        if (els.searchInput.value.trim().length > 0) {
            els.dayGrp.classList.remove('hidden');
            if(selection.day) renderRoutine();
        } else {
            els.dayGrp.classList.add('hidden');
            els.halfGrp.classList.add('hidden');
            clearResults();
        }
    });

    // Reset Button
    document.getElementById('reset-btn').addEventListener('click', () => {
        selection = { course: null, department: null, semester: null, section: null, day: null, half: null };
        document.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
        if(appMode === 'student') resetFrom('department');
        if(appMode === 'faculty') populateDatalist();
    });
}

// Rendering Logic
function getTargetSchedule() {
    if (appMode === 'student') {
        if (!selection.course || !selection.department || !selection.semester) return null;
        const base = dataset[selection.course][selection.department][selection.semester];
        return (base.sections && selection.section) ? base.sections[selection.section] : (base.days || null);
    } 
    else if (appMode === 'faculty') {
        const query = els.searchInput.value.trim();
        if (!query) return null;

        const filteredClasses = allClasses.filter(c => {
            if (searchMode === 'faculty') {
                if (!c.faculty) return false;
                return c.faculty.some(fStr => fStr.split(',').map(s=>s.trim()).includes(query));
            } else {
                return c.room && c.room.trim() === query;
            }
        });

        // Shape into standard schedule format { "Monday": [...], "Tuesday": [...] }
        const pseudoSchedule = {};
        filteredClasses.forEach(c => {
            if (!pseudoSchedule[c.day]) pseudoSchedule[c.day] = [];
            pseudoSchedule[c.day].push(c);
        });
        return pseudoSchedule;
    }
}

function renderRoutine() {
    els.routineResults.innerHTML = '';
    const schedule = getTargetSchedule();
    
    if (!schedule || !selection.day) {
        clearResults();
        return;
    }

    const days = selection.day === 'All' ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] : [selection.day];
    
    days.forEach(day => {
        let classes = schedule[day] || [];
        
        if (selection.half) {
            classes = classes.filter(c => {
                const hour = parseInt(c.start.split(':')[0], 10);
                return (hour < 14 ? '1st' : '2nd') === selection.half;
            });
        }

        if (selection.day === 'All') {
            const h3 = document.createElement('h3');
            h3.className = 'day-header';
            h3.textContent = day;
            els.routineResults.appendChild(h3);
        }

        if (classes.length === 0) {
            els.routineResults.innerHTML += `<p class="class-detail">No classes scheduled.</p>`;
        } else {
            classes.sort((a, b) => timeToMins(a.start) - timeToMins(b.start));
            classes.forEach(cls => els.routineResults.appendChild(createCard(cls)));
        }
    });

    updateLiveStatus(schedule);
}

function createCard(cls) {
    const div = document.createElement('div');
    div.className = `class-card type-${cls.type || 'class'}`;
    
    let html = `<div class="class-time">${formatTime(cls.start)} – ${formatTime(cls.end)}</div>
                <div class="class-subject">${cls.subject}</div>`;
                
    if (appMode === 'faculty') {
        const target = `${cls.course} ${cls.dept} S${cls.sem}` + (cls.sec ? ` [${cls.sec}]` : '');
        html += `<div class="class-detail"><span class="target-badge">${target}</span></div>`;
    }

    if (cls.faculty && cls.faculty.length > 0) html += `<div class="class-detail">Faculty: ${cls.faculty.join(', ')}</div>`;
    if (cls.room) html += `<div class="class-detail">Room: ${cls.room}</div>`;
    if (cls.type) html += `<span class="type-badge">${cls.type}</span>`;
    
    div.innerHTML = html;
    return div;
}

function clearResults() {
    els.routineResults.innerHTML = '<p class="placeholder-text">Select options to view routine.</p>';
    els.liveStatus.classList.add('hidden');
}

// Live Status Detection
function updateLiveStatus(scheduleOverride = null) {
    const schedule = scheduleOverride || getTargetSchedule();
    if (!schedule || !selection.day || selection.day === 'All') {
        els.liveStatus.classList.add('hidden');
        return;
    }

    const todayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];

    if (selection.day !== todayName) {
        els.liveStatus.classList.remove('hidden');
        els.currentClass.innerHTML = `<span class="class-detail">Select today to see live status.</span>`;
        els.nextClass.innerHTML = `-`;
        return;
    }

    const todayClasses = [...(schedule[todayName] || [])].sort((a, b) => timeToMins(a.start) - timeToMins(b.start));
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    
    let current = null, next = null;

    for (let cls of todayClasses) {
        const start = timeToMins(cls.start);
        const end = timeToMins(cls.end);

        if (currentMins >= start && currentMins < end) {
            current = cls;
        } else if (start > currentMins && !next) {
            next = cls;
        }
    }

    els.liveStatus.classList.remove('hidden');
    els.currentClass.innerHTML = current ? buildLiveCard(current) : 'No current class';
    els.nextClass.innerHTML = next ? buildLiveCard(next) : 'No more classes today';
}

function buildLiveCard(cls) {
    let targetHtml = '';
    if (appMode === 'faculty') {
        const target = `${cls.course} ${cls.dept} S${cls.sem}` + (cls.sec ? ` [${cls.sec}]` : '');
        targetHtml = `<div class="class-detail"><span class="target-badge" style="background:#475569; color:white;">${target}</span></div>`;
    }
    return `
        <div class="class-subject">${cls.subject}</div>
        <div class="class-time">${formatTime(cls.start)} – ${formatTime(cls.end)}</div>
        ${targetHtml}
        ${cls.room ? `<div class="class-detail">Room: ${cls.room}</div>` : ''}
    `;
}

// Helpers
function timeToMins(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

function formatTime(timeStr) {
    let [h, m] = timeStr.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m < 10 ? '0'+m : m} ${ampm}`;
}
