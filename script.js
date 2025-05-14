/**
 * -------------------------------------------------------------------
 * !!! গুরুত্বপূর্ণ: আপনার Apps Script Web app URL টি নিচে দিন !!!
 * Google Apps Script থেকে পাওয়া Web App URL টি এখানে পেস্ট করুন।
 * -------------------------------------------------------------------
 */
const GOOGLE_SHEET_API_URL = 'https://script.google.com/macros/s/AKfycbwVsTv_ri90dFrnJ_aQ5-P5nkPiFW1umBjS13qxuGzThMRBWberE_oB4Gwp0ibhjVRa5A/exec'; // <--- এই URL টি পরিবর্তন করুন

// --- DOM Elements ---
const courseContainer = document.getElementById('course-container');
const searchBox = document.getElementById('search-box');
const courseNameFilterSelect = document.getElementById('course-name-filter'); // Updated ID
const statusFilterSelect = document.getElementById('status-filter');
const sortBySelect = document.getElementById('sort-by');
const currentYearSpan = document.getElementById('current-year');

// Summary Elements
const totalCoursesSpan = document.getElementById('total-courses');
const inProgressCoursesSpan = document.getElementById('in-progress-courses');
const upcomingCoursesSpan = document.getElementById('upcoming-courses');
const completedCoursesSpan = document.getElementById('completed-courses');


// --- Global State ---
let allCoursesData = [];
let uniqueCourseNames = [];

/**
 * Helper Function: Parses DD-MM-YYYY string to a Date object (UTC Midnight).
 * (অপরিবর্তিত)
 */
function parseDMYtoDateUTC_JS(dateString) {
    if (!dateString || typeof dateString !== 'string') return null;
    const parts = dateString.trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (!parts) return null;
    const day = parseInt(parts[1], 10);
    const month = parseInt(parts[2], 10) - 1; // JS month is 0-indexed
    const year = parseInt(parts[3], 10);
    // Validate day and month ranges
    if (day < 1 || day > 31 || month < 0 || month > 11 || year < 1900 || year > 3000) {
         console.warn(`Date components out of range: ${dateString}`);
         return null;
    }
    const dateObj = new Date(Date.UTC(year, month, day));
    // Final validation check after object creation
    if (dateObj.getUTCFullYear() === year && dateObj.getUTCMonth() === month && dateObj.getUTCDate() === day) {
        return dateObj;
    }
    console.warn(`Invalid date constructed from string: ${dateString}`);
    return null;
}

/**
 * Populates the course name filter dropdown.
 * (নাম পরিবর্তন করা হয়েছে courseFilterSelect -> courseNameFilterSelect)
 */
function populateCourseNameFilter(courses) {
    if (!courseNameFilterSelect) {
        console.warn("Course name filter select element not found."); // Changed to warn
        return;
    }
    try {
        const courseNames = courses.map(course => course.courseName).filter(name => name);
        uniqueCourseNames = [...new Set(courseNames)].sort();
        courseNameFilterSelect.innerHTML = '<option value="all">All Course Names</option>';
        uniqueCourseNames.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            courseNameFilterSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Error populating course name filter:", error);
    }
}

/**
 * Updates the dashboard summary section.
 */
function updateDashboardSummary(courses) {
    if (!totalCoursesSpan || !inProgressCoursesSpan || !upcomingCoursesSpan || !completedCoursesSpan) {
        console.warn("One or more summary span elements not found in DOM.");
        return;
    }

    let total = 0; // Start with 0, count valid courses
    let inProgress = 0;
    let upcoming = 0;
    let completed = 0;

    courses.forEach(course => {
        // Use pre-calculated status if available, otherwise calculate for summary
        const status = course.status; // Assuming status is pre-calculated and added to course object
        if (status) { // Only count if status is valid
            total++; // Increment total for courses that have a determinable status
            if (status === "In Progress") inProgress++;
            else if (status === "Upcoming") upcoming++;
            else if (status === "Completed") completed++;
            // Ignore "Date Error" or other statuses for these specific counts
        }
    });

    totalCoursesSpan.textContent = total;
    inProgressCoursesSpan.textContent = inProgress;
    upcomingCoursesSpan.textContent = upcoming;
    completedCoursesSpan.textContent = completed;
}


/**
 * Fetches course data from the API.
 */
async function fetchCourseData() {
    courseContainer.innerHTML = `<div class="status-message loading-message"><div class="spinner"></div><p>Loading course data...</p></div>`;
    console.log("Fetching data from API...");

    try {
        if (!GOOGLE_SHEET_API_URL || GOOGLE_SHEET_API_URL === 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE' || GOOGLE_SHEET_API_URL.length < 20) {
             throw new Error("API URL is not configured in script.js.");
        }
        const response = await fetch(GOOGLE_SHEET_API_URL);

        if (!response.ok) {
            let errorMsg = `Network response error. Status: ${response.status} (${response.statusText})`;
            let responseText = await response.text();
            console.error(`Fetch failed: ${errorMsg}. Raw response: ${responseText}`);
             try {
                 const errorData = JSON.parse(responseText);
                 if (errorData && errorData.error) errorMsg = `API Error: ${errorData.error}`;
             } catch (e) { /* Ignore if not JSON */ }
            throw new Error(errorMsg);
        }

        const fetchedDataText = await response.text();
        console.log("Raw API Response:", fetchedDataText);

        let fetchedData;
        try {
             fetchedData = JSON.parse(fetchedDataText);
        } catch (e) {
             console.error("Failed to parse API response as JSON:", e);
             throw new Error("Received invalid data format from API. Check API response and Apps Script logs.");
        }


        if (!Array.isArray(fetchedData)) {
            console.error("API did not return an array:", fetchedData);
            throw new Error("Invalid data structure received from API (expected an array).");
        }

        console.log(`Fetched ${fetchedData.length} course records.`);
        
        allCoursesData = fetchedData.map(course => {
            const startDateObj = parseDMYtoDateUTC_JS(course.startDate);
            const calculatedEndDateObj = parseDMYtoDateUTC_JS(course.calculatedEndDate);
            let progress = 0;
            let status = "Upcoming"; // Default status

            if (startDateObj && calculatedEndDateObj && calculatedEndDateObj.getTime() >= startDateObj.getTime()) {
                const today = new Date();
                today.setUTCHours(0, 0, 0, 0);
                const totalDurationMillis = Math.max(0, calculatedEndDateObj.getTime() - startDateObj.getTime());

                if (today >= startDateObj) {
                    if (today < calculatedEndDateObj) {
                        const elapsedMillis = Math.max(0, today.getTime() - startDateObj.getTime());
                        progress = totalDurationMillis > 0 ? Math.min(100, (elapsedMillis / totalDurationMillis) * 100) : 100;
                        status = "In Progress";
                    } else {
                        progress = 100;
                        status = "Completed";
                    }
                }
                // If today < startDateObj, status remains "Upcoming" and progress 0
            } else {
                console.warn("Course with invalid or missing dates for progress calculation:", course);
                status = "Date Error"; // Mark courses with invalid dates for status
                progress = 0; // Or some other indicator
            }
            return { ...course, progress: progress, status: status };
        });

        populateCourseNameFilter(allCoursesData);
        updateDashboardSummary(allCoursesData);
        applyFiltersAndSort();

    } catch (error) {
        console.error('Error during data fetch and initial processing:', error);
        courseContainer.innerHTML = `
            <div class="status-message error-message">
                <p><strong><i class="fas fa-exclamation-triangle"></i> Failed to load course data.</strong></p>
                <p>${error.message}</p>
                <p>Please check the console (F12) for more details and verify API/Sheet configuration.</p>
            </div>`;
    }
}

/**
 * Filters AND sorts data, then calls display function.
 */
function applyFiltersAndSort() {
    const searchTerm = searchBox.value.toLowerCase().trim();
    const selectedCourseName = courseNameFilterSelect.value;
    const selectedStatus = statusFilterSelect.value;
    const sortBy = sortBySelect.value;

    console.log(`Applying filters: CourseName='${selectedCourseName}', Status='${selectedStatus}', Search='${searchTerm}', Sort='${sortBy}'`);


    let processedData = [...allCoursesData];

    // 1. Filter by Course Name
    if (selectedCourseName !== 'all') {
        processedData = processedData.filter(course => course.courseName === selectedCourseName);
    }

    // 2. Filter by Status
    if (selectedStatus !== 'all') {
        processedData = processedData.filter(course => course.status === selectedStatus);
    }

    // 3. Filter by Search Term (Name or Batch)
    if (searchTerm) {
        processedData = processedData.filter(course =>
            (course.courseName && course.courseName.toLowerCase().includes(searchTerm)) ||
            (course.batch && String(course.batch).toLowerCase().includes(searchTerm))
        );
    }

    // 4. Sort Data
    switch (sortBy) {
        case 'courseNameAsc':
            processedData.sort((a, b) => (a.courseName || "").localeCompare(b.courseName || ""));
            break;
        case 'courseNameDesc':
            processedData.sort((a, b) => (b.courseName || "").localeCompare(a.courseName || ""));
            break;
        case 'startDateAsc':
            processedData.sort((a, b) => {
                const dateA = parseDMYtoDateUTC_JS(a.startDate);
                const dateB = parseDMYtoDateUTC_JS(b.startDate);
                if (!dateA && !dateB) return 0; if (!dateA) return 1; if (!dateB) return -1;
                return dateA.getTime() - dateB.getTime();
            });
            break;
        case 'startDateDesc':
            processedData.sort((a, b) => {
                const dateA = parseDMYtoDateUTC_JS(a.startDate);
                const dateB = parseDMYtoDateUTC_JS(b.startDate);
                if (!dateA && !dateB) return 0; if (!dateA) return 1; if (!dateB) return -1;
                return dateB.getTime() - dateA.getTime();
            });
            break;
        case 'progressAsc':
            processedData.sort((a, b) => (a.progress || 0) - (b.progress || 0));
            break;
        case 'progressDesc':
            processedData.sort((a, b) => (b.progress || 0) - (a.progress || 0));
            break;
    }

    displayCourses(processedData);
}


/**
 * Renders course cards to the DOM.
 */
function displayCourses(coursesToDisplay) {
    courseContainer.innerHTML = '';

    if (!coursesToDisplay || coursesToDisplay.length === 0) {
        courseContainer.innerHTML = `<div class="status-message no-results-message"><p>No courses found matching your criteria.</p></div>`;
        return;
    }

    coursesToDisplay.forEach((course, index) => {
         try {
            const startDateString = course.startDate;
            const calculatedEndDateString = course.calculatedEndDate;
            const statusText = course.status;
            const progressPercent = course.progress;

            if (!course.courseName || !startDateString || !calculatedEndDateString) {
                throw new Error("Missing essential course data for card.");
            }
             if (statusText === "Date Error") { // Handle courses marked with date error
                 const card = document.createElement('article');
                 card.className = 'course-card invalid-date-card';
                 card.innerHTML = `
                     <div class="course-details">
                         <h2>${course.courseName}</h2>
                         <p class="batch-info">Batch: ${course.batch || 'N/A'}</p>
                         <p style="color: var(--danger-color);"><strong>Status:</strong> <span class="status-badge date-error">Date Error</span></p>
                         <p>There is an issue with the date configuration for this course.</p>
                     </div>`;
                 courseContainer.appendChild(card);
                 return; // Skip further processing for this card
             }


            let statusClass = statusText.toLowerCase().replace(/\s+/g, '-');
            let progressBarClass = statusClass;

            if (statusText === "Completed") { progressBarClass = ""; }
            else if (statusText === "In Progress") {
                if(progressPercent < 35) progressBarClass = "low";
                else if (progressPercent < 75) progressBarClass = "medium";
                else progressBarClass = "";
            } else if (statusText === "Upcoming") {
                progressBarClass = "upcoming";
            }


            const card = document.createElement('article');
            card.className = 'course-card';
            const displayPercent = progressPercent.toFixed(1);
            card.innerHTML = `
                <div class="course-details">
                    <h2>${course.courseName}</h2>
                    <p class="batch-info">Batch: ${course.batch || 'N/A'}</p>
                    <p><strong>Start Date:</strong> ${startDateString}</p>
                    <p><strong>End Date:</strong> ${calculatedEndDateString}</p>
                    <p><strong>Org. Duration:</strong> ${course.originalDurationDays ? course.originalDurationDays + ' days' : 'N/A'}</p>
                    <p><strong>Status:</strong> <span class="status-badge ${statusClass}">${statusText}</span></p>
                </div>
                <div class="progress-info">
                    <p><strong>Progress:</strong></p>
                    <div class="progress-bar-container" title="${displayPercent}% Completed">
                        <div class="progress-bar ${progressBarClass}" style="width: ${displayPercent}%;">
                             ${displayPercent}%
                             <span class="sr-only">${displayPercent}% Completed</span>
                        </div>
                    </div>
                </div>
            `;
            courseContainer.appendChild(card);

         } catch (cardError) {
             console.error(`Error creating card for course (Index ${index}):`, course, cardError);
             const errorCard = document.createElement('article');
             errorCard.className = 'course-card error-card';
             errorCard.innerHTML = `<h2>Error</h2><p>${course.courseName || 'Unknown Course'}</p><p style="color: var(--danger-color);">Could not display: ${cardError.message}</p>`;
             courseContainer.appendChild(errorCard);
         }
    });
}

/**
 * Sets the current year in the footer.
 */
function setFooterYear() {
    if (currentYearSpan) currentYearSpan.textContent = new Date().getFullYear();
}

/**
 * Initializes the dashboard.
 */
function initializeDashboard() {
    console.log("Initializing Dashboard...");
    setFooterYear();
    if(searchBox) searchBox.addEventListener('input', applyFiltersAndSort);
    else console.warn("Search box element not found.");
    if(courseNameFilterSelect) courseNameFilterSelect.addEventListener('change', applyFiltersAndSort);
    else console.warn("Course name filter select element not found.");
    if(statusFilterSelect) statusFilterSelect.addEventListener('change', applyFiltersAndSort);
    else console.warn("Status filter select element not found.");
    if(sortBySelect) sortBySelect.addEventListener('change', applyFiltersAndSort);
    else console.warn("Sort by select element not found.");

    fetchCourseData();
}

// --- Initialize ---
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDashboard);
} else {
    initializeDashboard();
}