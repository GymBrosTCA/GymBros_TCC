document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("confirmarCompra");
  const feedback = document.getElementById("feedback");
  const feedbackIcon = document.getElementById("feedbackIcon");
  const feedbackMsg = document.getElementById("feedbackMsg");

  btn.addEventListener("click", () => {
    const sucesso = Math.random() > 0.3;

    feedback.classList.add("active");

    if (sucesso) {
      feedback.classList.add("success");
      feedbackIcon.innerHTML = "<i class='fas fa-check'></i>";
      feedbackMsg.textContent = "Compra realizada com sucesso!";
    } else {
      feedback.classList.add("error");
      feedbackIcon.innerHTML = "<i class='fas fa-times'></i>";
      feedbackMsg.textContent = "Falha ao processar a compra.";
    }

    setTimeout(() => {
      feedback.style.opacity = '0';
      setTimeout(() => {
        feedback.classList.remove("active", "success", "error");
        feedback.style.opacity = '1';
        window.location.href = "/planos"; 
      }, 400); 
    }, 2500);
  });
});
