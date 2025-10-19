const sideMenu = document.getElementById("sideMenu");
const menuOverlay = document.getElementById("menuOverlay");
const closeMenu = document.getElementById("closeMenu");
const menuBtn = document.getElementById("menuBtn");
const usernameDisplay = document.getElementById("usernameDisplay");
const logoutBtn = document.getElementById("logoutBtn");

// Mock login
const mockUser = { nome: "Davi" };
usernameDisplay.textContent = mockUser.nome;

// Abrir side menu
menuBtn.addEventListener("click", () => {
  sideMenu.classList.add("show");
  menuOverlay.classList.add("show");
});

// Fechar side menu
closeMenu.addEventListener("click", () => {
  sideMenu.classList.remove("show");
  menuOverlay.classList.remove("show");
});

menuOverlay.addEventListener("click", () => {
  sideMenu.classList.remove("show");
  menuOverlay.classList.remove("show");
});

// Logout (mock)
logoutBtn.addEventListener("click", () => {
  alert("Logout realizado!");
  window.location.href = "/login";
});
