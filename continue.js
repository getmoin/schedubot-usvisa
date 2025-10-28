let userId = window.location.href.split("/")[6];
let country = window.location.href.split("/")[3];
window.localStorage.setItem("userId", userId);
window.location.href = `https://ais.usvisa-info.com/${country}/niv/schedule/${userId}/appointment/print_instructions`;
