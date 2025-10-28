let country = window.location.href.split("/")[3];
window.localStorage.setItem("currentAppointmentDate", null);
let userId = window.localStorage.getItem("userId");

let currentAppointmentDate = null;

function extractDateFromStrongTag() {
  const labels = document.querySelectorAll("label");
  for (const label of labels) {
    if (label.textContent.trim() === "Consular Section Interview Date:") {
      const adjacentPTag = label.nextElementSibling;
      if (adjacentPTag) {
        const strongTag = adjacentPTag.querySelector("strong");
        if (strongTag) {
          const dateString = strongTag.textContent.trim();
          const dateParts = dateString.split(",");
          if (dateParts.length >= 2) {
            const date = new Date(dateParts[0] + "," + dateParts[1]);
            if (!isNaN(date.getTime())) {
              const formattedDate = date.toISOString().split("T")[0];
              return formattedDate;
            }
          }
        }
      }
    }
  }
  return null; // Return null if not found or unable to extract the date
}

function goToAppointmentPage() {
  console.log("Redirecting to appointment page in 1 second...");
  setTimeout(() => {
    document.location.href = `https://ais.usvisa-info.com/${country}/niv/schedule/${userId}/appointment`;
  }, 1000);
}

function tryExtractAndRedirect() {
  console.log("Attempting to extract appointment date...");

  // Try to extract the date
  currentAppointmentDate = extractDateFromStrongTag();

  if (currentAppointmentDate) {
    console.log("Successfully extracted date:", currentAppointmentDate);
    window.localStorage.setItem("currentAppointmentDate", currentAppointmentDate);
    goToAppointmentPage();
  } else {
    console.log("Date not found yet, waiting for page to load...");
    // If date not found, try again after a short delay
    setTimeout(() => {
      currentAppointmentDate = extractDateFromStrongTag();
      if (currentAppointmentDate) {
        console.log("Successfully extracted date on retry:", currentAppointmentDate);
        window.localStorage.setItem("currentAppointmentDate", currentAppointmentDate);
      } else {
        console.log("No appointment date found - user may not have an existing appointment");
        // Set a far future date if no appointment exists
        window.localStorage.setItem("currentAppointmentDate", new Date(2099, 0, 1).toISOString().split("T")[0]);
      }
      goToAppointmentPage();
    }, 2000);
  }
}

// Wait for DOM to be ready, then try extraction
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", tryExtractAndRedirect);
} else {
  // DOM is already ready
  setTimeout(tryExtractAndRedirect, 500);
}
