/**
 * @file Final version of the course dashboard script for As-Sunnah Skill Development Institute.
 */

const CourseDashboard = (() => {
    const GOOGLE_SHEET_API_URL = 'https://script.google.com/macros/s/AKfycbwVsTv_ri90dFrnJ_aQ5-P5nkPiFW1umBjS13qxuGzThMRBWberE_oB4Gwp0ibhjVRa5A/exec';

    const UI = {
        courseContainer: document.getElementById('course-container'),
        searchBox: document.getElementById('search-box'),
        courseNameFilter: document.getElementById('course-name-filter'),
        statusFilter: document.getElementById('status-filter'),
        sortBy: document.getElementById('sort-by'),
        totalCourses: document.getElementById('total-courses'),
        inProgressCourses: document.getElementById('in-progress-courses'),
        upcomingCourses: document.getElementById('upcoming-courses'),
        completedCourses: document.getElementById('completed-courses'),
        currentYearSidebar: document.getElementById('current-year-sidebar')
    };

    let allCourses = [];

    const parseDMYtoDate = (dateString) => {
        if (!dateString || typeof dateString !== 'string') return null;
        const parts = dateString.trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
        if (!parts) return null;
        const day = parseInt(parts[1], 10);
        const month = parseInt(parts[2], 10) - 1;
        const year = parseInt(parts[3], 10);
        const date = new Date(Date.UTC(year, month, day));
        if (date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day) {
            return date;
        }
        return null;
    };

    const processCourseData = (rawData) => {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        return rawData.map(course => {
            const startDate = parseDMYtoDate(course.startDate);
            const endDate = parseDMYtoDate(course.calculatedEndDate);
            let status = 'Date Error';
            let progress = 0;

            if (startDate && endDate && endDate.getTime() >= startDate.getTime()) {
                if (today >= startDate) {
                    if (today < endDate) {
                        status = 'In Progress';
                        const totalDuration = endDate.getTime() - startDate.getTime();
                        const elapsed = today.getTime() - startDate.getTime();
                        progress = totalDuration > 0 ? Math.min(100, (elapsed / totalDuration) * 100) : 100;
                    } else {
                        status = 'Completed';
                        progress = 100;
                    }
                } else {
                    status = 'Upcoming';
                }
            }
            return { ...course, status, progress };
        });
    };
    
    const renderStatusMessage = (type, message) => {
        let content = `<div class="status-message"><p>${message}</p></div>`;
        if (type === 'loading') {
            content = `<div class="status-message"><div class="spinner"></div><p>${message}</p></div>`;
        }
        UI.courseContainer.innerHTML = content;
    };

    const populateFilters = () => {
        const courseNames = [...new Set(allCourses.map(c => c.courseName).filter(Boolean))].sort();
        UI.courseNameFilter.innerHTML = '<option value="all">Filter by Course</option>';
        courseNames.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            UI.courseNameFilter.appendChild(option);
        });
    };

    const updateSummary = () => {
        const stats = { total: 0, inProgress: 0, upcoming: 0, completed: 0 };
        allCourses.forEach(course => {
            if (course.status !== 'Date Error') {
                stats.total++;
                if (course.status === 'In Progress') stats.inProgress++;
                if (course.status === 'Upcoming') stats.upcoming++;
                if (course.status === 'Completed') stats.completed++;
            }
        });
        UI.totalCourses.textContent = stats.total;
        UI.inProgressCourses.textContent = stats.inProgress;
        UI.upcomingCourses.textContent = stats.upcoming;
        UI.completedCourses.textContent = stats.completed;
    };

    const createCourseCardHTML = (course) => {
        const statusClass = course.status.toLowerCase().replace(/\s+/g, '-');
        const displayPercent = course.progress.toFixed(0);
        const durationText = course.originalDurationDays ? `${course.originalDurationDays} days` : 'N/A';

        return `
            <div class="course-card">
                <div data-label="Course Name">
                    <p class="course-name">${course.courseName || 'N/A'}</p>
                    <p class="course-batch">Batch: ${course.batch || 'N/A'}</p>
                </div>
                <div data-label="Duration"><p>${durationText}</p></div>
                <div data-label="Start Date"><p>${course.startDate || 'N/A'}</p></div>
                <div data-label="End Date"><p>${course.calculatedEndDate || 'N/A'}</p></div>
                <div data-label="Status"><span class="status-badge ${statusClass}">${course.status}</span></div>
                <div data-label="Progress" class="progress-info">
                    <div class="progress-bar-container" title="${displayPercent}% Completed">
                        <div class="progress-bar" style="width: ${displayPercent}%;"></div>
                    </div>
                    <span>${displayPercent}%</span>
                </div>
            </div>`;
    };

    const renderCourses = (courses) => {
        if (courses.length === 0) {
            renderStatusMessage('no-results', 'No courses found matching your criteria.');
            return;
        }
        UI.courseContainer.innerHTML = courses.map(createCourseCardHTML).join('');
    };

    const handleFilterAndSort = () => {
        const filters = {
            searchTerm: UI.searchBox.value.toLowerCase().trim(),
            courseName: UI.courseNameFilter.value,
            status: UI.statusFilter.value
        };
        const sortBy = UI.sortBy.value;

        let filtered = allCourses.filter(course => {
            const matchesSearch = !filters.searchTerm ||
                (course.courseName && course.courseName.toLowerCase().includes(filters.searchTerm)) ||
                (course.batch && String(course.batch).toLowerCase().includes(filters.searchTerm));
            const matchesName = filters.courseName === 'all' || course.courseName === filters.courseName;
            const matchesStatus = filters.status === 'all' || course.status === filters.status;
            return matchesSearch && matchesName && matchesStatus;
        });

        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'startDateAsc':
                    return (parseDMYtoDate(a.startDate)?.getTime() || 0) - (parseDMYtoDate(b.startDate)?.getTime() || 0);
                case 'startDateDesc':
                    return (parseDMYtoDate(b.startDate)?.getTime() || 0) - (parseDMYtoDate(a.startDate)?.getTime() || 0);
                case 'courseNameDesc':
                     return (b.courseName || "").localeCompare(a.courseName || "");
                default:
                    return (a.courseName || "").localeCompare(b.courseName || "");
            }
        });

        renderCourses(filtered);
    };

    const attachEventListeners = () => {
        [UI.searchBox, UI.courseNameFilter, UI.statusFilter, UI.sortBy].forEach(element => {
            if (element) {
                const eventType = element.tagName === 'INPUT' ? 'input' : 'change';
                element.addEventListener(eventType, handleFilterAndSort);
            }
        });
    };

    const init = async () => {
        renderStatusMessage('loading', 'Loading Courses...');
        attachEventListeners();
        if(UI.currentYearSidebar) UI.currentYearSidebar.textContent = new Date().getFullYear();

        try {
            const response = await fetch(GOOGLE_SHEET_API_URL);
            if (!response.ok) throw new Error(`Network error: ${response.statusText}`);
            const data = await response.json();
            if (!Array.isArray(data)) throw new Error("Invalid data format received.");

            allCourses = processCourseData(data);
            populateFilters();
            updateSummary();
            handleFilterAndSort();

        } catch (error) {
            console.error("Dashboard Initialization Failed:", error);
            renderStatusMessage('error', `Failed to load course data. ${error.message}`);
        }
    };

    return { init };
})();

document.addEventListener('DOMContentLoaded', CourseDashboard.init);