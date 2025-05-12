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
const currentYearSpan = document.getElementById('current-year');

// --- Global State ---
let allCoursesData = []; // Store all fetched courses for filtering

/**
 * Helper Function: DD-MM-YYYY স্ট্রিংকে Date অবজেক্টে পার্স করে
 * @param {string} dateString - "DD-MM-YYYY" ফরম্যাটের তারিখ
 * @returns {Date|null} Date object or null if invalid
 */
function parseDMYtoDate_JS(dateString) {
    if (!dateString || typeof dateString !== 'string') return null;
    const parts = dateString.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (!parts) return null;
    const day = parseInt(parts[1], 10);
    const month = parseInt(parts[2], 10) - 1; // JS Date মাস 0-indexed
    const year = parseInt(parts[3], 10);
    const dateObj = new Date(Date.UTC(year, month, day)); // Use UTC to avoid timezone issues during parsing/calculation
    // Validate date (e.g., avoids Feb 30)
    if (dateObj.getUTCFullYear() === year && dateObj.getUTCMonth() === month && dateObj.getUTCDate() === day) {
        return dateObj;
    }
    return null;
}

/**
 * Helper Function: ডেট অবজেক্টকে DD-MM-YYYY স্ট্রিং এ ফরম্যাট করে
 * @param {Date} dateObject
 * @returns {string} Formatted date string or "N/A"
 */
function formatDateToDMY_JS(dateObject) {
    if (!(dateObject instanceof Date) || isNaN(dateObject.getTime())) return "N/A";
    const day = ('0' + dateObject.getUTCDate()).slice(-2);
    const month = ('0' + (dateObject.getUTCMonth() + 1)).slice(-2); // Month is 1-indexed for display
    const year = dateObject.getUTCFullYear();
    return `${day}-${month}-${year}`;
}


/**
 * Fetches course data from the Google Apps Script API and initiates display.
 */
async function fetchAndDisplayCourses() {
    // Show loading indicator
    courseContainer.innerHTML = `
        <div class="status-message loading-message">
            <div class="spinner"></div>
            <p>Loading course data, please wait...</p>
        </div>`;

    try {
        if (!GOOGLE_SHEET_API_URL || GOOGLE_SHEET_API_URL === 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') {
             throw new Error("Google Apps Script API URL is not configured in script.js.");
        }
        const response = await fetch(GOOGLE_SHEET_API_URL);

        if (!response.ok) {
            let errorMsg = `HTTP error! Status: ${response.status}`;
            try {
                // Try to parse potential JSON error from Apps Script
                const errorData = await response.json();
                if (errorData && errorData.error) {
                    errorMsg = `API Error: ${errorData.error}`;
                }
            } catch (e) { /* Ignore parsing error, use original HTTP error */ }
            throw new Error(errorMsg);
        }

        allCoursesData = await response.json();

        // Check for error property within the JSON response itself
        if (allCoursesData.error) {
            throw new Error(`API Error: ${allCoursesData.error}`);
        }

        // Data fetched successfully, display it
        displayCourses(allCoursesData);

    } catch (error) {
        console.error('Error fetching or processing course data:', error);
        courseContainer.innerHTML = `
            <div class="status-message error-message">
                <p><strong>Error:</strong> Failed to load course data.</p>
                <p>${error.message}</p>
                <p>Please check the API URL configuration or try again later.</p>
            </div>`;
    }
}

/**
 * Renders the course cards on the page based on the provided data array.
 * @param {Array} coursesToDisplay - Array of course objects to display.
 */
function displayCourses(coursesToDisplay) {
    courseContainer.innerHTML = ''; // Clear previous content/messages

    if (!coursesToDisplay || coursesToDisplay.length === 0) {
        courseContainer.innerHTML = `
            <div class="status-message no-results-message">
                <p>${searchBox.value ? 'No courses match your search criteria.' : 'No courses found.'}</p>
            </div>`;
        return;
    }

    coursesToDisplay.forEach(course => {
        const startDateString = course.startDate; // "DD-MM-YYYY" from API
        const calculatedEndDateString = course.calculatedEndDate; // "DD-MM-YYYY" from API

        if (!startDateString || !calculatedEndDateString) {
            console.warn('Skipping course due to missing date strings:', course);
            return;
        }

        const startDateObj = parseDMYtoDate_JS(startDateString);
        const calculatedEndDateObj = parseDMYtoDate_JS(calculatedEndDateString);

        if (!startDateObj || !calculatedEndDateObj) {
            console.warn('Skipping course due to invalid date parsing in JS:', course);
            return;
        }

        const today = new Date();
        // Set today to UTC start of day for consistent comparison
        today.setUTCHours(0, 0, 0, 0);

        let progressPercent = 0;
        let statusText = "Upcoming";
        let progressBarClass = "upcoming";

        // Ensure end date is not before start date
        if (calculatedEndDateObj < startDateObj) {
            console.warn('End date is before start date for course:', course);
             // Optionally handle this case, maybe mark as error or use original duration?
             // For now, we'll show it as upcoming/0%
        } else {
            const totalDurationMillis = calculatedEndDateObj.getTime() - startDateObj.getTime();

            if (today >= startDateObj && totalDurationMillis >= 0) { // Course has started or starts today
                 if (today < calculatedEndDateObj) { // Course in progress
                     const elapsedMillis = today.getTime() - startDateObj.getTime();
                     // Avoid division by zero if start and end date are the same
                     progressPercent = totalDurationMillis > 0 ? Math.min(100, Math.max(0, (elapsedMillis / totalDurationMillis) * 100)) : 100;
                     statusText = "In Progress";
                 } else { // Course completed (today is on or after end date)
                     progressPercent = 100;
                     statusText = "Completed";
                 }
            } else if (today < startDateObj) { // Course hasn't started yet
                progressPercent = 0;
                statusText = "Upcoming";
            }
            // else case (today >= endDate) is covered above
        }

        // Determine progress bar color class based on percentage
        if (statusText === "In Progress" || statusText === "Completed") {
             if(progressPercent < 33) progressBarClass = "low";
             else if (progressPercent < 66) progressBarClass = "medium";
             else progressBarClass = ""; // Default green (no extra class)
        } // Else keep 'upcoming' class


        // Create the course card HTML
        const card = document.createElement('article'); // Use article tag
        card.className = 'course-card';
        card.innerHTML = `
            <div> <!-- Added wrapper for non-progress content -->
                <h2>${course.courseName || 'Unnamed Course'}</h2>
                <p class="batch-info">Batch: ${course.batch || 'N/A'}</p>
                <p><strong>Start Date:</strong> ${startDateString}</p>
                <p><strong>End Date:</strong> ${calculatedEndDateString}</p>
                <p><strong>Org. Duration:</strong> ${course.originalDurationDays ? course.originalDurationDays + ' days' : 'N/A'}</p>
                <p><strong>Status:</strong> ${statusText}</p>
            </div>
            <div class="progress-info">
                <div class="progress-bar-container">
                    <div class="progress-bar ${progressBarClass}" style="width: ${progressPercent.toFixed(1)}%;">
                        ${progressPercent.toFixed(1)}%
                    </div>
                </div>
            </div>
        `;
        courseContainer.appendChild(card);
    });
}

/**
 * Event Listener for the search box to filter courses dynamically.
 */
searchBox.addEventListener('input', (e) => { // Use 'input' for real-time filtering
    const searchTerm = e.target.value.toLowerCase().trim();
    const filteredCourses = allCoursesData.filter(course => {
        const name = course.courseName ? course.courseName.toLowerCase() : '';
        const batch = course.batch ? course.batch.toLowerCase() : '';
        return name.includes(searchTerm) || batch.includes(searchTerm);
    });
    displayCourses(filteredCourses);
});

/**
 * Sets the current year in the footer.
 */
function setFooterYear() {
    if (currentYearSpan) {
        currentYearSpan.textContent = new Date().getFullYear();
    }
}

/**
 * Initializes the dashboard on page load.
 */
function initializeDashboard() {
    setFooterYear();
    fetchAndDisplayCourses();
    // Optional: Auto-refresh data periodically
    // setInterval(fetchAndDisplayCourses, 5 * 60 * 1000); // Refresh every 5 minutes
}

// --- Initialize ---
initializeDashboard();