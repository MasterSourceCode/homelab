/**
 * Calendar Module
 * Family calendar integration with Google Calendar via FullCalendar
 * Supports full CRUD operations with OAuth2 authentication
 */

import { GOOGLE_CALENDAR_API_KEY, GOOGLE_CALENDAR_ID, CALENDAR_TIMEZONE } from './config.js';
import { FAMILY_MEMBERS } from './google-oauth-config.js';
import { $ } from './utils.js';
import {
    isAuthenticated,
    initiateOAuthFlow,
    logout,
    createEvent,
    updateEvent,
    deleteEvent,
    getFamilyMemberByColorId
} from './google-calendar-api.js';

let calendarInstance = null;
let currentEditingEvent = null;

// ============================================
// CALENDAR INITIALIZATION
// ============================================

export function initCalendar() {
    const calendarEl = $('calendarContainer');
    if (!calendarEl) return;

    // Check if FullCalendar is loaded
    if (typeof FullCalendar === 'undefined') {
        console.error('FullCalendar not loaded');
        return;
    }

    // Update auth button state
    updateAuthButton();

    calendarInstance = new FullCalendar.Calendar(calendarEl, {
        // View options
        initialView: 'timeGridWeek',
        headerToolbar: false, // We use custom toolbar

        // Appearance
        themeSystem: 'standard',
        height: '100%',
        nowIndicator: true,
        dayMaxEvents: 3,
        navLinks: true,
        weekNumbers: false,
        selectable: isAuthenticated(), // Allow selection if authenticated
        selectMirror: true,

        // Time settings
        timeZone: CALENDAR_TIMEZONE,
        firstDay: 1, // Monday

        // Google Calendar integration (read-only public access)
        googleCalendarApiKey: GOOGLE_CALENDAR_API_KEY,
        eventSources: [
            {
                googleCalendarId: GOOGLE_CALENDAR_ID,
                className: 'gcal-event'
            }
        ],

        // Event display customization with family member colors
        eventDidMount: function(info) {
            const colorId = info.event.extendedProps?.colorId;
            if (colorId) {
                const member = getFamilyMemberByColorId(colorId);
                if (member) {
                    info.el.style.backgroundColor = member.color;
                    info.el.style.borderColor = member.color;
                }
            }

            // Add tooltip with full event details
            if (info.event.extendedProps.description) {
                info.el.title = info.event.extendedProps.description;
            }
        },

        // View change handler
        viewDidMount: function(info) {
            updateViewButtons(info.view.type);
        },

        // Date click - open create modal
        dateClick: function(info) {
            if (!isAuthenticated()) {
                showAuthPrompt();
                return;
            }
            openCreateEventModal(info.dateStr, info.allDay);
        },

        // Date range selection - open create modal with range
        select: function(info) {
            if (!isAuthenticated()) {
                showAuthPrompt();
                return;
            }
            openCreateEventModal(info.startStr, info.allDay, info.endStr);
        },

        // Event click - show details with edit option
        eventClick: function(info) {
            info.jsEvent.preventDefault();
            showEventDetails(info.event);
        },

        // Loading indicator
        loading: function(isLoading) {
            const loader = $('calendarLoader');
            if (loader) {
                loader.classList.toggle('hidden', !isLoading);
            }
        }
    });

    calendarInstance.render();
}

// ============================================
// AUTHENTICATION
// ============================================

export function updateAuthButton() {
    const authBtn = $('calendarAuthBtn');
    const authStatus = $('calendarAuthStatus');

    if (authBtn) {
        if (isAuthenticated()) {
            authBtn.innerHTML = `
                <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                </svg>
                <span>Connected</span>
            `;
            authBtn.classList.remove('bg-violet-500/20', 'border-violet-500/30', 'text-violet-400');
            authBtn.classList.add('bg-emerald-500/20', 'border-emerald-500/30', 'text-emerald-400');
        } else {
            authBtn.innerHTML = `
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/>
                </svg>
                <span>Sign In</span>
            `;
            authBtn.classList.remove('bg-emerald-500/20', 'border-emerald-500/30', 'text-emerald-400');
            authBtn.classList.add('bg-violet-500/20', 'border-violet-500/30', 'text-violet-400');
        }
    }

    if (authStatus) {
        authStatus.textContent = isAuthenticated() ? 'Signed in - can add events' : 'Sign in to add events';
    }
}

export function toggleCalendarAuth() {
    if (isAuthenticated()) {
        if (confirm('Sign out of Google Calendar? You will not be able to add/edit events.')) {
            logout();
            updateAuthButton();
            refreshCalendar();
        }
    } else {
        initiateOAuthFlow();
    }
}

function showAuthPrompt() {
    const modal = $('calendarAuthModal');
    if (modal) modal.classList.remove('hidden');
}

export function closeAuthModal() {
    const modal = $('calendarAuthModal');
    if (modal) modal.classList.add('hidden');
}

export function signInAndClose() {
    closeAuthModal();
    initiateOAuthFlow();
}

// ============================================
// VIEW CONTROLS
// ============================================

export function changeCalendarView(view) {
    if (!calendarInstance) return;

    const viewMap = {
        'month': 'dayGridMonth',
        'week': 'timeGridWeek',
        'day': 'timeGridDay'
    };

    calendarInstance.changeView(viewMap[view] || view);
    updateViewButtons(viewMap[view] || view);
}

export function calendarToday() {
    if (!calendarInstance) return;
    calendarInstance.today();
}

export function calendarPrev() {
    if (!calendarInstance) return;
    calendarInstance.prev();
}

export function calendarNext() {
    if (!calendarInstance) return;
    calendarInstance.next();
}

function updateViewButtons(currentView) {
    const buttons = ['month', 'week', 'day'];
    const viewMap = {
        'dayGridMonth': 'month',
        'timeGridWeek': 'week',
        'timeGridDay': 'day'
    };

    buttons.forEach(btn => {
        const el = $(`calBtn${btn.charAt(0).toUpperCase() + btn.slice(1)}`);
        if (el) {
            const isActive = viewMap[currentView] === btn;
            el.classList.toggle('bg-violet-500/30', isActive);
            el.classList.toggle('border-violet-500/50', isActive);
            el.classList.toggle('text-violet-400', isActive);
            el.classList.toggle('bg-white/5', !isActive);
            el.classList.toggle('border-white/10', !isActive);
            el.classList.toggle('text-white/60', !isActive);
        }
    });
}

// ============================================
// EVENT CREATION MODAL
// ============================================

export function openCreateEventModal(dateStr, allDay = true, endDateStr = null) {
    const modal = $('eventCreateModal');
    if (!modal) return;

    currentEditingEvent = null;

    // Reset form
    $('eventFormTitle').value = '';
    $('eventFormDescription').value = '';
    $('eventFormLocation').value = '';
    $('eventFormAllDay').checked = allDay;
    $('eventFormAssignee').value = 'everyone';

    // Set dates
    if (allDay) {
        $('eventFormStartDate').value = dateStr;
        $('eventFormEndDate').value = endDateStr || dateStr;
        $('eventFormStartTime').value = '';
        $('eventFormEndTime').value = '';
    } else {
        const date = dateStr.split('T')[0];
        const time = dateStr.split('T')[1]?.substring(0, 5) || '09:00';
        $('eventFormStartDate').value = date;
        $('eventFormEndDate').value = endDateStr?.split('T')[0] || date;
        $('eventFormStartTime').value = time;
        $('eventFormEndTime').value = incrementTime(time, 1);
    }

    toggleTimeInputs(allDay);
    updateAssigneePreview('everyone');

    // Update modal title
    $('eventModalTitle').textContent = 'New Event';
    $('eventDeleteBtn')?.classList.add('hidden');

    modal.classList.remove('hidden');
}

export function openEditEventModal(eventData) {
    const modal = $('eventCreateModal');
    if (!modal) return;

    currentEditingEvent = eventData;

    // Populate form
    $('eventFormTitle').value = eventData.title || '';
    $('eventFormDescription').value = eventData.description || '';
    $('eventFormLocation').value = eventData.location || '';
    $('eventFormAllDay').checked = eventData.allDay;

    // Extract assignee from description or colorId
    let assignee = 'everyone';
    if (eventData.extendedProps?.colorId) {
        const member = getFamilyMemberByColorId(eventData.extendedProps.colorId);
        assignee = member.key;
    }
    $('eventFormAssignee').value = assignee;

    // Set dates
    if (eventData.allDay) {
        $('eventFormStartDate').value = eventData.startStr;
        $('eventFormEndDate').value = eventData.endStr || eventData.startStr;
    } else {
        $('eventFormStartDate').value = eventData.startStr.split('T')[0];
        $('eventFormEndDate').value = (eventData.endStr || eventData.startStr).split('T')[0];
        $('eventFormStartTime').value = eventData.startStr.split('T')[1]?.substring(0, 5) || '09:00';
        $('eventFormEndTime').value = eventData.endStr?.split('T')[1]?.substring(0, 5) || '10:00';
    }

    toggleTimeInputs(eventData.allDay);
    updateAssigneePreview(assignee);

    // Update modal title and show delete button
    $('eventModalTitle').textContent = 'Edit Event';
    $('eventDeleteBtn')?.classList.remove('hidden');

    modal.classList.remove('hidden');
}

export function closeCreateEventModal() {
    const modal = $('eventCreateModal');
    if (modal) modal.classList.add('hidden');
    currentEditingEvent = null;
}

function toggleTimeInputs(allDay) {
    const timeInputs = $('eventTimeInputs');
    if (timeInputs) {
        timeInputs.classList.toggle('hidden', allDay);
    }
}

function incrementTime(time, hours) {
    const [h, m] = time.split(':').map(Number);
    const newH = (h + hours) % 24;
    return `${String(newH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function onAllDayChange() {
    const allDay = $('eventFormAllDay').checked;
    toggleTimeInputs(allDay);
}

export function updateAssigneePreview(value) {
    const preview = $('assigneePreview');
    if (!preview) return;

    const member = FAMILY_MEMBERS[value];
    if (member) {
        preview.style.backgroundColor = member.color;
        preview.textContent = member.name.charAt(0);
    }
}

// ============================================
// EVENT SAVE/DELETE
// ============================================

export async function saveEvent() {
    const title = $('eventFormTitle').value.trim();
    if (!title) {
        alert('Please enter an event title');
        return;
    }

    const allDay = $('eventFormAllDay').checked;
    const assignee = $('eventFormAssignee').value;

    const eventData = {
        title: title,
        description: $('eventFormDescription').value.trim(),
        location: $('eventFormLocation').value.trim(),
        assignee: assignee,
        allDay: allDay
    };

    if (allDay) {
        eventData.startDate = $('eventFormStartDate').value;
        eventData.endDate = $('eventFormEndDate').value || eventData.startDate;
    } else {
        const startDate = $('eventFormStartDate').value;
        const startTime = $('eventFormStartTime').value || '09:00';
        const endDate = $('eventFormEndDate').value || startDate;
        const endTime = $('eventFormEndTime').value || '10:00';

        eventData.startDateTime = `${startDate}T${startTime}:00`;
        eventData.endDateTime = `${endDate}T${endTime}:00`;
    }

    // Show loading state
    const saveBtn = $('eventSaveBtn');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;

    try {
        if (currentEditingEvent) {
            await updateEvent(currentEditingEvent.id, eventData);
        } else {
            await createEvent(eventData);
        }

        closeCreateEventModal();
        refreshCalendar();
    } catch (error) {
        console.error('Failed to save event:', error);
        alert('Failed to save event: ' + error.message);
    } finally {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
    }
}

export async function deleteCurrentEvent() {
    if (!currentEditingEvent) return;

    if (!confirm('Delete this event?')) return;

    const deleteBtn = $('eventDeleteBtn');
    const originalText = deleteBtn.textContent;
    deleteBtn.textContent = 'Deleting...';
    deleteBtn.disabled = true;

    try {
        await deleteEvent(currentEditingEvent.id);
        closeCreateEventModal();
        closeEventModal();
        refreshCalendar();
    } catch (error) {
        console.error('Failed to delete event:', error);
        alert('Failed to delete event: ' + error.message);
    } finally {
        deleteBtn.textContent = originalText;
        deleteBtn.disabled = false;
    }
}

// ============================================
// EVENT DETAILS MODAL
// ============================================

function showEventDetails(event) {
    const modal = $('eventDetailModal');
    if (!modal) return;

    // Store event reference for editing
    currentEditingEvent = event;

    // Format dates
    const startDate = event.start;
    const endDate = event.end;
    const isAllDay = event.allDay;

    let dateStr = '';
    if (isAllDay) {
        dateStr = startDate.toLocaleDateString('en-ZA', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        if (endDate && endDate.getTime() - startDate.getTime() > 86400000) {
            dateStr += ' - ' + new Date(endDate.getTime() - 86400000).toLocaleDateString('en-ZA', {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
            });
        }
    } else {
        dateStr = startDate.toLocaleDateString('en-ZA', {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
        });
        dateStr += ' at ' + startDate.toLocaleTimeString('en-ZA', {
            hour: '2-digit',
            minute: '2-digit'
        });
        if (endDate) {
            dateStr += ' - ' + endDate.toLocaleTimeString('en-ZA', {
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    }

    // Get assignee from color
    let assignee = null;
    if (event.extendedProps?.colorId) {
        assignee = getFamilyMemberByColorId(event.extendedProps.colorId);
    }

    // Update modal content
    const titleEl = $('eventTitle');
    const dateEl = $('eventDate');
    const descEl = $('eventDescription');
    const locationEl = $('eventLocation');
    const assigneeEl = $('eventAssignee');
    const editBtn = $('eventEditBtn');

    if (titleEl) titleEl.textContent = event.title;
    if (dateEl) dateEl.textContent = dateStr;

    if (descEl) {
        let desc = event.extendedProps.description || '';
        // Remove assignee tag from description if present
        desc = desc.replace(/^\[\w+\]\s*/, '');
        descEl.textContent = desc || 'No description';
        descEl.classList.toggle('text-white/30', !desc);
    }

    if (locationEl) {
        const loc = event.extendedProps.location;
        locationEl.textContent = loc || '';
        locationEl.parentElement.classList.toggle('hidden', !loc);
    }

    if (assigneeEl) {
        if (assignee) {
            assigneeEl.innerHTML = `
                <div class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style="background-color: ${assignee.color}">
                    ${assignee.name.charAt(0)}
                </div>
                <span>${assignee.name}</span>
            `;
            assigneeEl.parentElement.classList.remove('hidden');
        } else {
            assigneeEl.parentElement.classList.add('hidden');
        }
    }

    // Show/hide edit button based on auth
    if (editBtn) {
        editBtn.classList.toggle('hidden', !isAuthenticated());
    }

    // Show modal
    modal.classList.remove('hidden');
}

export function closeEventModal() {
    const modal = $('eventDetailModal');
    if (modal) modal.classList.add('hidden');
}

export function editCurrentEvent() {
    if (!currentEditingEvent) return;
    closeEventModal();
    openEditEventModal(currentEditingEvent);
}

// ============================================
// CALENDAR REFRESH
// ============================================

export function refreshCalendar() {
    if (!calendarInstance) return;
    calendarInstance.refetchEvents();
}

// ============================================
// CALENDAR FILTER & SIDEBAR
// ============================================

let activeFilter = 'everyone';
let cachedEvents = [];

export function toggleCalendarFilter(filter) {
    // Update active filter
    activeFilter = filter;

    // Update chip styles
    const chips = document.querySelectorAll('.calendar-filter-chip');
    chips.forEach(chip => {
        const chipFilter = chip.id.replace('filter', '').toLowerCase();
        chip.classList.toggle('active', chipFilter === filter);
    });

    // Refresh calendar events with filter
    if (calendarInstance) {
        calendarInstance.refetchEvents();
    }

    // Update upcoming events list
    updateUpcomingEvents();
}

export function quickAddEvent(type) {
    if (!isAuthenticated()) {
        showAuthPrompt();
        return;
    }

    const today = new Date().toISOString().split('T')[0];
    openCreateEventModal(today, true);

    // Pre-fill based on type
    setTimeout(() => {
        const titleInput = $('eventFormTitle');
        const descInput = $('eventFormDescription');

        if (type === 'reminder') {
            titleInput.placeholder = 'What do you need to remember?';
            titleInput.focus();
        } else if (type === 'task') {
            titleInput.placeholder = 'What needs to be done?';
            titleInput.focus();
        } else if (type === 'birthday') {
            titleInput.placeholder = "Whose birthday is it?";
            titleInput.focus();
            // For birthdays, suggest yearly recurrence (manual addition for now)
            descInput.value = '🎂 Birthday celebration';
        }
    }, 100);
}

export function updateUpcomingEvents() {
    const container = $('upcomingEventsList');
    if (!container || !calendarInstance) return;

    // Get events for the next 7 days
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekFromNow = new Date(today);
    weekFromNow.setDate(weekFromNow.getDate() + 7);

    const events = calendarInstance.getEvents()
        .filter(event => {
            const eventStart = event.start;
            return eventStart >= today && eventStart < weekFromNow;
        })
        .filter(event => {
            // Apply family member filter
            if (activeFilter === 'everyone') return true;
            const colorId = event.extendedProps?.colorId;
            if (!colorId) return activeFilter === 'everyone';
            const member = getFamilyMemberByColorId(colorId);
            return member && member.key === activeFilter;
        })
        .sort((a, b) => a.start - b.start)
        .slice(0, 8); // Limit to 8 events

    cachedEvents = events;

    if (events.length === 0) {
        container.innerHTML = `
            <div class="calendar-empty-state">
                <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
                <span class="text-sm">No upcoming events</span>
                <span class="text-xs text-white/20">Click + to add one</span>
            </div>
        `;
        return;
    }

    const todayStr = today.toDateString();

    container.innerHTML = events.map(event => {
        const isToday = event.start.toDateString() === todayStr;
        const day = event.start.getDate();
        const month = event.start.toLocaleDateString('en-ZA', { month: 'short' });

        let timeStr = 'All day';
        if (!event.allDay) {
            timeStr = event.start.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
        }

        // Get assignee info
        let assigneeHtml = '';
        const colorId = event.extendedProps?.colorId;
        if (colorId) {
            const member = getFamilyMemberByColorId(colorId);
            if (member) {
                assigneeHtml = `
                    <div class="upcoming-event-assignee assignee-${member.key}">
                        ${member.name.charAt(0)}
                    </div>
                `;
            }
        }

        return `
            <div class="upcoming-event-card ${isToday ? 'today' : ''}" onclick="window.calendar.showEventById('${event.id}')">
                <div class="upcoming-event-date">
                    <div class="day">${day}</div>
                    <div class="month">${month}</div>
                </div>
                <div class="upcoming-event-info">
                    <div class="upcoming-event-title">${event.title}</div>
                    <div class="upcoming-event-time">${timeStr}</div>
                </div>
                ${assigneeHtml}
            </div>
        `;
    }).join('');
}

export function updateCalendarStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get start and end of week
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    // Update week range display
    const weekRangeEl = $('calendarWeekRange');
    if (weekRangeEl) {
        weekRangeEl.textContent = `${monday.getDate()} - ${sunday.getDate()} ${sunday.toLocaleDateString('en-ZA', { month: 'short' })}`;
    }

    if (!calendarInstance) return;

    const weekEvents = calendarInstance.getEvents().filter(event => {
        const eventStart = event.start;
        return eventStart >= monday && eventStart <= sunday;
    });

    // Count events, tasks, and busy days
    let eventCount = 0;
    let taskCount = 0;
    const busyDays = new Set();

    weekEvents.forEach(event => {
        const title = event.title.toLowerCase();
        const desc = (event.extendedProps?.description || '').toLowerCase();

        if (title.includes('task') || desc.includes('task') || desc.includes('todo')) {
            taskCount++;
        } else {
            eventCount++;
        }

        // Track busy days
        const dayKey = event.start.toDateString();
        busyDays.add(dayKey);
    });

    // Update stats display
    const eventCountEl = $('weekEventCount');
    const taskCountEl = $('weekTaskCount');
    const busyDaysEl = $('weekBusyDays');

    if (eventCountEl) eventCountEl.textContent = eventCount;
    if (taskCountEl) taskCountEl.textContent = taskCount;
    if (busyDaysEl) busyDaysEl.textContent = busyDays.size;
}

export function showEventById(eventId) {
    if (!calendarInstance) return;

    const event = calendarInstance.getEventById(eventId);
    if (event) {
        // Trigger the event click handler
        const modal = $('eventDetailModal');
        if (!modal) return;

        currentEditingEvent = event;

        // Use the existing showEventDetails logic
        const startDate = event.start;
        const endDate = event.end;
        const isAllDay = event.allDay;

        let dateStr = '';
        if (isAllDay) {
            dateStr = startDate.toLocaleDateString('en-ZA', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
        } else {
            dateStr = startDate.toLocaleDateString('en-ZA', {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
            });
            dateStr += ' at ' + startDate.toLocaleTimeString('en-ZA', {
                hour: '2-digit',
                minute: '2-digit'
            });
            if (endDate) {
                dateStr += ' - ' + endDate.toLocaleTimeString('en-ZA', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }
        }

        let assignee = null;
        if (event.extendedProps?.colorId) {
            assignee = getFamilyMemberByColorId(event.extendedProps.colorId);
        }

        const titleEl = $('eventTitle');
        const dateEl = $('eventDate');
        const descEl = $('eventDescription');
        const locationEl = $('eventLocation');
        const assigneeEl = $('eventAssignee');
        const editBtn = $('eventEditBtn');

        if (titleEl) titleEl.textContent = event.title;
        if (dateEl) dateEl.textContent = dateStr;

        if (descEl) {
            let desc = event.extendedProps.description || '';
            desc = desc.replace(/^\[\w+\]\s*/, '');
            descEl.textContent = desc || 'No description';
            descEl.classList.toggle('text-white/30', !desc);
        }

        if (locationEl) {
            const loc = event.extendedProps.location;
            locationEl.textContent = loc || '';
            locationEl.parentElement.classList.toggle('hidden', !loc);
        }

        if (assigneeEl) {
            if (assignee) {
                assigneeEl.innerHTML = `
                    <div class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style="background-color: ${assignee.color}">
                        ${assignee.name.charAt(0)}
                    </div>
                    <span>${assignee.name}</span>
                `;
                assigneeEl.parentElement.classList.remove('hidden');
            } else {
                assigneeEl.parentElement.classList.add('hidden');
            }
        }

        if (editBtn) {
            editBtn.classList.toggle('hidden', !isAuthenticated());
        }

        modal.classList.remove('hidden');
    }
}

// ============================================
// CLEANUP
// ============================================

export function destroyCalendar() {
    if (calendarInstance) {
        calendarInstance.destroy();
        calendarInstance = null;
    }
}
