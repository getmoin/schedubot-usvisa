let country = window.location.href.split("/")[3];
window.localStorage.setItem("country", country);

function reload() {
  setTimeout(() => {
    window.location.reload();
    reload();
  }, 180000);
}
