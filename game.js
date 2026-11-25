document.addEventListener("DOMContentLoaded", () => {
  const lobbyScreen = document.getElementById("lobby-screen");
  const battleScreen = document.getElementById("battle-screen");
  const btnStart = document.getElementById("btn-start-game");
  const btnBack = document.getElementById("btn-back-lobby");
  const srStatus = document.getElementById("sr-status");

  function announce(message) {
    if (srStatus) {
      srStatus.textContent = "";
      setTimeout(() => {
        srStatus.textContent = message;
      }, 30);
    }
  }

  if (btnStart) {
    btnStart.addEventListener("click", () => {
      if (lobbyScreen) lobbyScreen.hidden = true;
      if (battleScreen) battleScreen.hidden = false;
      announce("Đã vào màn hình tác chiến.");
    });
  }

  if (btnBack) {
    btnBack.addEventListener("click", () => {
      if (battleScreen) battleScreen.hidden = true;
      if (lobbyScreen) lobbyScreen.hidden = false;
      announce("Đã quay về sảnh chính.");
    });
  }
});
