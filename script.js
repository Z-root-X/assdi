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
const courseFilterSelect = document.getElementById('course-filter');
const currentYearSpan = document.getElementById('current-year');

// --- Global State ---
let allCoursesData = [];
let uniqueCourseNames = [];

/**
 * Helper Function: Parses DD-MM-YYYY string to a Date object (UTC Midnight).
 * @param {string} dateString - Date in "DD-MM-YYYY" format.
 * @returns {Date|null} Date object (UTC midnight) or null if invalid.
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
 * Populates the course filter dropdown.
 * @param {Array} courses - Array of course objects.
 */
function populateCourseFilter(courses) {
    if (!courseFilterSelect) {
        console.error("Course filter select element not found.");
        return;
    }
    try {
        const courseNames = courses.map(course => course.courseName).filter(name => name); // Ensure name exists
        uniqueCourseNames = [...new Set(courseNames)].sort();
        courseFilterSelect.innerHTML = '<option value="all">All Courses</option>';
        uniqueCourseNames.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            courseFilterSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Error populating course filter:", error);
    }
}

/**
 * Fetches course data from the API.
 */
async function fetchCourseData() {
    courseContainer.innerHTML = `
        <div class="status-message loading-message">
            <div class="spinner" role="status" aria-label="Loading"></div>
            <p>Loading course data, please wait...</p>
        </div>`;
    console.log("Fetching data from API..."); // Debug Log

    try {
        if (!GOOGLE_SHEET_API_URL || GOOGLE_SHEET_API_URL === 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE' || GOOGLE_SHEET_API_URL.length < 20) {
             throw new Error("API URL is not configured. Please update 'GOOGLE_SHEET_API_URL' in script.js.");
        }
        const response = await fetch(GOOGLE_SHEET_API_URL);

        if (!response.ok) {
            let errorMsg = `Network response error. Status: ${response.status} (${response.statusText})`;
            let responseText = await response.text(); // Get raw response text for debugging
            console.error(`Fetch failed: ${errorMsg}. Raw response: ${responseText}`);
             try {
                 const errorData = JSON.parse(responseText); // Try to parse if it was JSON
                 if (errorData && errorData.error) errorMsg = `API Error: ${errorData.error}`;
             } catch (e) { /* Ignore if not JSON */ }
            throw new Error(errorMsg);
        }

        const fetchedDataText = await response.text(); // Get response as text first for logging
        console.log("Raw API Response:", fetchedDataText); // Debug Log

        let fetchedData;
        try {
             fetchedData = JSON.parse(fetchedDataText); // Now parse as JSON
        } catch (e) {
             console.error("Failed to parse API response as JSON:", e);
             throw new Error("Received invalid data format from API. Check API response and Apps Script logs.");
        }


        if (!Array.isArray(fetchedData)) {
            console.error("API did not return an array:", fetchedData);
            throw new Error("Invalid data structure received from API (expected an array).");
        }

        console.log(`Fetched ${fetchedData.length} course records.`); // Debug Log
        allCoursesData = fetchedData;
        populateCourseFilter(allCoursesData);
        filterAndDisplayCourses(); // Display initial data

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
 * Filters data based on current selections and calls display function.
 */
function filterAndDisplayCourses() {
    const searchTerm = searchBox.value.toLowerCase().trim();
    const selectedCourse = courseFilterSelect.value;
    console.log(`Filtering: Course='${selectedCourse}', Search='${searchTerm}'`); // Debug Log

    const filteredData = allCoursesData.filter(course => {
        try { // Add try-catch within filter for robustness
            const courseNameMatch = selectedCourse === 'all' || (course.courseName && course.courseName === selectedCourse);

            const searchMatch = !searchTerm ||
                                (course.courseName && course.courseName.toLowerCase().includes(searchTerm)) ||
                                (course.batch && String(course.batch).toLowerCase().includes(searchTerm)); // Safer includes check

            return courseNameMatch && searchMatch;
        } catch (filterError) {
            console.error("Error filtering course:", course, filterError);
            return false; // Exclude problematic course data from filter results
        }
    });

    console.log(`Displaying ${filteredData.length} filtered courses.`); // Debug Log
    displayCourses(filteredData);
}


/**
 * Renders course cards to the DOM.
 * @param {Array} coursesToDisplay - Filtered array of course objects.
 */
function displayCourses(coursesToDisplay) {
    courseContainer.innerHTML = ''; // Clear container

    if (!coursesToDisplay || coursesToDisplay.length === 0) {
        courseContainer.innerHTML = `
            <div class="status-message no-results-message">
                <p>${(searchBox.value || courseFilterSelect.value !== 'all') ? 'No courses found matching your criteria.' : 'No courses available to display.'}</p>
            </div>`;
        return;
    }

    coursesToDisplay.forEach((course, index) => {
         try { // Wrap card creation in try-catch
            const startDateString = course.startDate;
            const calculatedEndDateString = course.calculatedEndDate;

            if (!course.courseName || !startDateString || !calculatedEndDateString) {
                throw new Error("Missing essential course data (name or dates).");
            }

            const startDateObj = parseDMYtoDateUTC_JS(startDateString);
            const calculatedEndDateObj = parseDMYtoDateUTC_JS(calculatedEndDateString);

            if (!startDateObj || !calculatedEndDateObj || calculatedEndDateObj.getTime() < startDateObj.getTime()) {
                 throw new Error(`Invalid dates (Start: ${startDateString}, End: ${calculatedEndDateString}).`);
            }

            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);

            let progressPercent = 0;
            let statusText = "Upcoming";
            let statusClass = "upcoming";
            let progressBarClass = "upcoming";

            const totalDurationMillis = Math.max(0, calculatedEndDateObj.getTime() - startDateObj.getTime());
            const MS_PER_DAY = 24 * 60 * 60 * 1000;

            if (today >= startDateObj) {
                if (today < calculatedEndDateObj) {
                    const elapsedMillis = Math.max(0, today.getTime() - startDateObj.getTime());
                    progressPercent = totalDurationMillis > 0 ? Math.min(100, (elapsedMillis / totalDurationMillis) * 100) : 100;
                    statusText = "In Progress";
                    statusClass = "in-progress";
                } else {
                    progressPercent = 100;
                    statusText = "Completed";
                    statusClass = "completed";
                }
            } // else status remains "Upcoming"

            // Determine progress bar color
            if (statusText === "Completed") { progressBarClass = ""; }
            else if (statusText === "In Progress") {
                if(progressPercent < 35) progressBarClass = "low";
                else if (progressPercent < 75) progressBarClass = "medium";
                else progressBarClass = "";
            } // else keeps 'upcoming'


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
             // Optionally display an error card
             const errorCard = document.createElement('article');
             errorCard.className = 'course-card error-card'; // Add specific class for styling
             errorCard.innerHTML = `<h2>Error Displaying Course</h2><p>${course.courseName || 'Unknown Course'}</p><p style="color: var(--danger-color);">Could not render details: ${cardError.message}</p>`;
             courseContainer.appendChild(errorCard);
         }
    });
}

/**
 * Sets the current year in the footer.
 */
function setFooterYear() {
    if (currentYearSpan) {
        currentYearSpan.textContent = new Date().getFullYear();
    }
}

/**
 * Initializes the dashboard.
 */
function initializeDashboard() {
    console.log("Initializing Dashboard..."); // Debug Log
    setFooterYear();
    // Add event listeners only if elements exist
    if(searchBox) {
        searchBox.addEventListener('input', filterAndDisplayCourses);
    } else { console.warn("Search box element not found."); }
    if(courseFilterSelect) {
        courseFilterSelect.addEventListener('change', filterAndDisplayCourses);
    } else { console.warn("Course filter select element not found."); }

    fetchCourseData(); // Fetch data on initialization
}

// --- Initialize ---
// Ensure script runs after the DOM is fully loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDashboard);
} else {
    // DOMContentLoaded has already fired
    initializeDashboard();
}