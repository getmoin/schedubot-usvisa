let country = window.location.href.split("/")[3];
function reload() {
  setTimeout(() => {
    window.location.reload();
    reload();
  }, 5000);
}
try {
  if (window.localStorage.getItem("user_email")) {
    document.getElementById("user_email").value =
      window.localStorage.getItem("user_email");
  }
  if (window.localStorage.getItem("user_password")) {
    document.getElementById("user_password").value =
      window.localStorage.getItem("user_password");
  }
  if (
    document.getElementById("user_email").value &&
    document.getElementById("user_password").value
  ) {
    document.getElementById("policy_confirmed").checked = true;
    document.getElementsByName("commit")[0].click();
  }
  document.forms[0].onsubmit = () => {
    window.localStorage.setItem(
      "user_email",
      document.getElementById("user_email").value,
    );
    window.localStorage.setItem(
      "user_password",
      document.getElementById("user_password").value,
    );
  };
} catch (exception) {
  reload();
}
