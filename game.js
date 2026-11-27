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

  function openTerrain3D() {
    if (window.Terrain3D) {
      window.Terrain3D.init();
      setTimeout(() => {
        if (window.Terrain3D && typeof window.Terrain3D.resize === "function") {
          window.Terrain3D.resize();
        }
      }, 60);
    }
  }

  if (btnStart) {
    btnStart.addEventListener("click", () => {
      if (lobbyScreen) lobbyScreen.hidden = true;
      if (battleScreen) battleScreen.hidden = false;
      openTerrain3D();
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
