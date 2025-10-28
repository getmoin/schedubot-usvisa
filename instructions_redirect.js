let country = window.location.href.split("/")[3];
let userId = window.localStorage.getItem("userId");
window.location.href = `https://ais.usvisa-info.com/${country}/niv/users/sign_in`;
