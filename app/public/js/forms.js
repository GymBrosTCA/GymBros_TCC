async function handleFormSubmit(formId, route) {
  const form = document.getElementById(formId);
  if (!form) return;

  let successSpan = form.querySelector(".success-message");
  if (!successSpan) {
    successSpan = document.createElement("span");
    successSpan.className = "success-message";
    form.prepend(successSpan);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    document.querySelectorAll(".error-message").forEach(span => span.textContent = "");
    successSpan.textContent = "";
    successSpan.style.color = "#4CAF50";

    const formData = Object.fromEntries(new FormData(form).entries());

    try {
      const res = await fetch(route, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      const result = await res.json();

      if (!res.ok) {
        result.erros.forEach(err => {
          const span = document.getElementById(`${err.param}-error`);
          if (span) span.textContent = err.msg;
        });
      } else {
        successSpan.textContent = result.mensagem;
        setTimeout(() => {
          if (route === "/register") window.location.href = "/login";
          else if (route === "/login" && result.redirect) window.location.href = result.redirect;
        }, 1200);
      }

    } catch (err) {
      console.error(err);
      successSpan.textContent = "Erro ao enviar formulário.";
      successSpan.style.color = "#ff4d4d";
    }
  });
}

handleFormSubmit("registerForm", "/register");
handleFormSubmit("loginForm", "/login");

document.addEventListener("input", e => {
  const span = document.getElementById(`${e.target.id}-error`);
  if (span) span.textContent = "";
});
