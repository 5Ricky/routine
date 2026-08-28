// Central State
let dataset = null;
let metadata = null;
let selection = { course: null, department: null, semester: null, section: null, day: null, half: null };

// DOM Elements
const els = {
    courseGrp: document.getElementById('course-group'), courseBtns: document.getElementById('course-buttons'),
    deptGrp: document.getElementById('dept-group'), deptBtns: document.getElementById('dept-buttons'),
    semGrp: document.getElementById('sem-group'), semBtns: document.getElementById('sem-buttons'),
    secGrp: document.getElementById('sec-group'), secBtns: document.getElementById('sec-buttons'),
    dayGrp: document.getElementById('day-group'), halfGrp: document.getElementById('half-group'),
    routineResults: document.getElementById('routine-results'), liveStatus: document.getElementById('live-status'),
    currentClass: document.getElementById('current-class-content'), nextClass: document.getElementById('next-class-content')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetch('./data/timetable.json')
        .then(response => response.json())
        .then(data => {
            dataset = data.schedule; 
            metadata = data.metadata;
            createButtons(Object.keys(dataset), els.courseBtns, 'course');
        })
        .catch(err => console.error("Error loading timetable:", err));

    setupListeners();
    setInterval(updateLiveStatus, 60000);
});

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
            // Department has sections
            createButtons(Object.keys(semData.sections), els.secBtns, 'section');
            els.secGrp.classList.remove('hidden');
            els.dayGrp.classList.add('hidden');
        } else if (semData.days) {
            // Department has NO sections
            selection.section = null;
            els.secGrp.classList.add('hidden');
            els.dayGrp.classList.remove('hidden');
        }
    } else if (type === 'section') {
        selection.section = value;
        resetFrom('day');
        els.dayGrp.classList.remove('hidden');
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
    document.querySelector('.options-panel').addEventListener('click', (e) => {
        if (e.target.classList.contains('option-btn')) {
            handleSelection(e.target.dataset.type, e.target.dataset.value, e.target);
        }
    });

    document.getElementById('reset-btn').addEventListener('click', () => {
        selection = { course: null, department: null, semester: null, section: null, day: null, half: null };
        document.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
        resetFrom('department');
    });
}

// Rendering Logic
function getTargetSchedule() {
    if (!selection.course || !selection.department || !selection.semester) return null;
    const base = dataset[selection.course][selection.department][selection.semester];
    
    if (base.sections && selection.section) {
        return base.sections[selection.section];
    } else if (base.days) {
        return base.days;
    }
    return null;
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
        
        // Custom logic to handle 1st Half / 2nd Half filtering
        // Assumption based on your JSON: Recess ends at 14:00. Classes starting < 14:00 are 1st half.
        if (selection.half) {
            classes = classes.filter(c => {
                const hour = parseInt(c.start.split(':')[0], 10);
                const classHalf = hour < 14 ? '1st' : '2nd';
                return classHalf === selection.half;
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
                
    if (cls.faculty && cls.faculty.length > 0) {
        html += `<div class="class-detail">Faculty: ${cls.faculty.join(', ')}</div>`;
    }
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
    return `
        <div class="class-subject">${cls.subject}</div>
        <div class="class-time">${formatTime(cls.start)} – ${formatTime(cls.end)}</div>
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