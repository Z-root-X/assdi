// !!! গুরুত্বপূর্ণ: আপনার Apps Script Web app URL টি এখানে দিন !!!
const GOOGLE_SHEET_API_URL = 'https://script.google.com/macros/s/AKfycbwVsTv_ri90dFrnJ_aQ5-P5nkPiFW1umBjS13qxuGzThMRBWberE_oB4Gwp0ibhjVRa5A/exec';

const courseContainer = document.getElementById('course-container');
const searchBox = document.getElementById('search-box');
let allCoursesData = [];

document.getElementById('current-year').textContent = new Date().getFullYear();

/**
 * DD-MM-YYYY ফরম্যাটের তারিখ স্ট্রিংকে Date অবজেক্টে রূপান্তর করে
 * @param {string} dateString - "DD-MM-YYYY" ফরম্যাটের তারিখ
 * @return {Date|null} Date অবজেক্ট অথবা ভুল ফরম্যাট হলে null
 */
function parseDMYtoDate_JS(dateString) {
    if (!dateString || typeof dateString !== 'string') return null;
    const parts = dateString.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (!parts) return null;
    // parts[1] = DD, parts[2] = MM, parts[3] = YYYY
    const day = parseInt(parts[1], 10);
    const month = parseInt(parts[2], 10) - 1; // JS Date মাস 0-indexed
    const year = parseInt(parts[3], 10);
    const dateObj = new Date(year, month, day);
    if (dateObj.getFullYear() === year && dateObj.getMonth() === month && dateObj.getDate() === day) {
        return dateObj;
    }
    return null;
}


async function fetchAndDisplayCourses() {
    courseContainer.innerHTML = '<p class="loading-message">Fetching latest course data...</p>';
    try {
        const response = await fetch(GOOGLE_SHEET_API_URL);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: `HTTP error! status: ${response.status}` }));
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        allCoursesData = await response.json();

        if (allCoursesData.error) {
             throw new Error(`API Error: ${allCoursesData.error}`);
        }
        displayCourses(allCoursesData);

    } catch (error) {
        console.error('Error fetching or processing course data:', error);
        courseContainer.innerHTML = `<p class="error-message">Failed to load course data. ${error.message}.</p>`;
    }
}

function displayCourses(coursesToDisplay) {
    courseContainer.innerHTML = '';

    if (!coursesToDisplay || coursesToDisplay.length === 0) {
        courseContainer.innerHTML = searchBox.value ? 
            '<p class="no-results-message">No courses match your search.</p>' : 
            '<p class="no-results-message">No courses found.</p>';
        return;
    }

    coursesToDisplay.forEach(course => {
        // API থেকে আসা startDate এবং calculatedEndDate DD-MM-YYYY ফরম্যাটে আছে
        const startDateString = course.startDate; // "DD-MM-YYYY"
        const calculatedEndDateString = course.calculatedEndDate; // "DD-MM-YYYY"

        if (!startDateString || !calculatedEndDateString) {
            console.warn('Skipping course due to missing date strings:', course);
            return;
        }

        const startDateObj = parseDMYtoDate_JS(startDateString);
        const calculatedEndDateObj = parseDMYtoDate_JS(calculatedEndDateString);
        
        if (!startDateObj || !calculatedEndDateObj) {
            console.warn('Skipping course due to invalid date parsing:', course);
            return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let progressPercent = 0;
        let statusText = "Upcoming";
        let progressBarClass = "low";

        // মোট সময়কাল গণনা (দিনে)
        const totalDurationMillis = calculatedEndDateObj.getTime() - startDateObj.getTime();
        const totalActualDays = Math.max(1, Math.round(totalDurationMillis / (1000 * 60 * 60 * 24))); //至少 ১ দিন

        if (today >= startDateObj && totalDurationMillis >= 0) { // totalDurationMillis >= 0 মানে calculatedEndDateObj >= startDateObj
            if (today < calculatedEndDateObj) {
                const elapsedMillis = today.getTime() - startDateObj.getTime();
                progressPercent = Math.min(100, Math.max(0, (elapsedMillis / totalDurationMillis) * 100));
                statusText = "In Progress";
            } else { // today >= calculatedEndDateObj
                progressPercent = 100;
                statusText = "Completed";
            }
        } else if (today < startDateObj) {
            progressPercent = 0;
            statusText = "Upcoming";
        }
        // else case (today >= calculatedEndDateObj) is covered above


        if(progressPercent < 33) progressBarClass = "low";
        else if (progressPercent < 66) progressBarClass = "medium";
        else progressBarClass = ""; // Default green for >= 66%

        const card = document.createElement('div');
        card.className = 'course-card';
        card.innerHTML = `
            <h2>${course.courseName}</h2>
            <p class="batch-info">Batch: ${course.batch}</p>
            <p><strong>Start Date:</strong> ${startDateString}</p> <!-- API থেকে আসা DD-MM-YYYY ফরম্যাট -->
            <p><strong>End Date (Est/Actual):</strong> ${calculatedEndDateString}</p> <!-- API থেকে আসা DD-MM-YYYY ফরম্যাট -->
            <p><strong>Original Duration:</strong> ${course.originalDurationDays ? course.originalDurationDays + ' days' : 'N/A'}</p>
            <p><strong>Status:</strong> ${statusText}</p>
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

searchBox.addEventListener('keyup', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filteredCourses = allCoursesData.filter(course => {
        const name = course.courseName ? course.courseName.toLowerCase() : '';
        const batch = course.batch ? course.batch.toLowerCase() : '';
        return name.includes(searchTerm) || batch.includes(searchTerm);
    });
    displayCourses(filteredCourses);
});

fetchAndDisplayCourses();
// setInterval(fetchAndDisplayCourses, 300000); // প্রতি ৫ মিনিটে অটো-রিফ্রেশ (ঐচ্ছিক)