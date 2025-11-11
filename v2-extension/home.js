let country = window.location.href.split("/")[3];
if (
  document.getElementsByTagName("h0")[0] &&
  document.getElementsByTagName("h0")[0].innerHTML.includes("Maintenance")
)
  window.location.href = `https://ais.usvisa-info.com/${country}/en-ca/niv/users/sign_in`;



let userId = window.localStorage.getItem("userId");
const currentAppointmentDate = window.localStorage.getItem("currentAppointmentDate");
if (currentAppointmentDate && userId) {
  window.location.href = `https://ais.usvisa-info.com/${country}/niv/schedule/${userId}/appointment/print_instructions`;
}

const groups = document
  .querySelectorAll("div.attend_appointment > div > div.text-right > ul > li > a")

if (groups && groups.length === 1) {
  groups[0].click();
}
