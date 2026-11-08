(function () {
  "use strict";

  const WHATSAPP_NUMBER = "5534998959051";
  const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
  const ALLOWED_EXT = ["pdf", "doc", "docx"];

  const NIVEIS = {
    nunca: "Nunca treinei",
    iniciante: "Iniciante (até 6 meses)",
    intermediario: "Intermediário (6 meses a 2 anos)",
    avancado: "Avançado (mais de 2 anos)"
  };

  const form = document.getElementById("anamnese");
  const cpfInput = document.getElementById("cpf");
  const fileInput = document.getElementById("laudo");
  const dropzone = document.getElementById("dropzone");
  const dzEmpty = document.getElementById("dz-empty");
  const dzFile = document.getElementById("dz-file");
  const statusEl = document.getElementById("status");

  function setError(name, message) {
    if (!form) return;
    const el = form.querySelector('[data-error-for="' + name + '"]');
    if (!el) return;
    el.textContent = message || "";
    const field = el.closest(".field");
    if (field) field.classList.toggle("invalid", !!message);
  }

  function formatSize(bytes) {
    if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1).replace(".", ",") + " MB";
  }

  function getExt(name) {
    const i = name.lastIndexOf(".");
    return i === -1 ? "" : name.slice(i + 1).toLowerCase();
  }

  function formatDate(iso) {
    if (!iso) return "Não informada";
    const p = iso.split("-");
    return p[2] + "/" + p[1] + "/" + p[0];
  }

  function maskCpf(value) {
    const d = value.replace(/\D/g, "").slice(0, 11);
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2");
  }

  function isValidCpf(value) {
    const cpf = value.replace(/\D/g, "");
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

    function digit(len) {
      let sum = 0;
      for (let i = 0; i < len; i++) sum += parseInt(cpf[i], 10) * (len + 1 - i);
      const r = (sum * 10) % 11;
      return r === 10 ? 0 : r;
    }
    return digit(9) === parseInt(cpf[9], 10) && digit(10) === parseInt(cpf[10], 10);
  }

  if (cpfInput) {
    cpfInput.addEventListener("input", () => {
      cpfInput.value = maskCpf(cpfInput.value);
    });
  }

  function validateFile(file) {
    if (!file) return "Envie o laudo médico em PDF ou Word.";
    if (ALLOWED_EXT.indexOf(getExt(file.name)) === -1) {
      return "Formato não aceito. Envie um arquivo PDF, DOC ou DOCX.";
    }
    if (file.size > MAX_SIZE) {
      return "O arquivo tem mais de 10 MB. Envie uma versão menor.";
    }
    return "";
  }

  function showFile(file) {
    if (!dzEmpty || !dzFile || !fileInput) return;
    document.getElementById("file-name").textContent = file.name;
    document.getElementById("file-size").textContent = formatSize(file.size);
    document.getElementById("file-ext").textContent = getExt(file.name).toUpperCase();
    dzEmpty.hidden = true;
    dzFile.hidden = false;
    fileInput.style.pointerEvents = "none";
  }

  function clearFile() {
    if (!dzEmpty || !dzFile || !fileInput) return;
    fileInput.value = "";
    dzEmpty.hidden = false;
    dzFile.hidden = true;
    fileInput.style.pointerEvents = "";
  }

  if (fileInput) {
    fileInput.addEventListener("change", () => {
      const file = fileInput.files[0];
      const error = file ? validateFile(file) : "";
      if (error) {
        clearFile();
        setError("laudo", error);
        return;
      }
      setError("laudo", "");
      if (file) showFile(file);
    });
  }

  const fileRemoveBtn = document.getElementById("file-remove");
  if (fileRemoveBtn) {
    fileRemoveBtn.addEventListener("click", () => {
      clearFile();
      setError("laudo", "");
    });
  }

  if (dropzone) {
    ["dragenter", "dragover"].forEach(evt => {
      dropzone.addEventListener(evt, () => dropzone.classList.add("dragover"));
    });
    ["dragleave", "drop"].forEach(evt => {
      dropzone.addEventListener(evt, () => dropzone.classList.remove("dragover"));
    });
  }

  function validateForm() {
    if (!form) return true;
    let ok = true;

    const nome = form.nome.value.trim();
    if (nome.split(/\s+/).length < 2) {
      setError("nome", "Digite seu nome completo.");
      ok = false;
    } else setError("nome", "");

    if (!isValidCpf(form.cpf.value)) {
      setError("cpf", "CPF inválido. Confira os números digitados.");
      ok = false;
    } else setError("cpf", "");

    const nasc = form.nascimento.value;
    const hoje = new Date().toISOString().slice(0, 10);
    if (!nasc) {
      setError("nascimento", "Informe sua data de nascimento.");
      ok = false;
    } else if (nasc > hoje || nasc < "1900-01-01") {
      setError("nascimento", "Data de nascimento inválida.");
      ok = false;
    } else setError("nascimento", "");

    if (!form.querySelector('input[name="nivel"]:checked')) {
      setError("nivel", "Escolha o nível que mais combina com você.");
      ok = false;
    } else setError("nivel", "");

    const fileError = validateFile(fileInput ? fileInput.files[0] : null);
    setError("laudo", fileError);
    if (fileError) ok = false;

    if (!form.consentimento.checked) {
      setError("consentimento", "Marque a autorização para enviar a ficha.");
      ok = false;
    } else setError("consentimento", "");

    return ok;
  }

  function buildWhatsappTableText(data, file) {
    const modalidades = Array.from(form.querySelectorAll('input[name="modalidades"]:checked'))
      .map(i => i.nextElementSibling.textContent)
      .join(", ") || "Não informado";

    const freq = form.frequencia.value
      ? form.frequencia.options[form.frequencia.selectedIndex].text
      : "Não informado";

    const obs = (data.get("observacoes") || "").trim() || "Nenhuma";

    return [
      "📋 *NOVA FICHA DE ANAMNESE*",
      "----------------------------------",
      "👤 *Nome:* " + data.get("nome").trim(),
      "🆔 *CPF:* " + data.get("cpf"),
      "🎂 *Nascimento:* " + formatDate(data.get("nascimento")),
      "⭐ *Nível:* " + NIVEIS[data.get("nivel")],
      "🏋️ *Modalidades:* " + modalidades,
      "📅 *Treinos/sem:* " + freq,
      "📝 *Observações:* " + obs,
      "----------------------------------",
      "📎 *Laudo:* " + (file ? file.name : "Nenhum") + " (anexando na conversa)"
    ].join("\n");
  }

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (statusEl) {
        statusEl.className = "status";
        statusEl.textContent = "";
      }

      if (!validateForm()) {
        const firstInvalid = form.querySelector(".field.invalid");
        if (firstInvalid) firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      const data = new FormData(form);
      const file = fileInput ? fileInput.files[0] : null;

      if (WHATSAPP_NUMBER) {
        const url = "https://wa.me/" + WHATSAPP_NUMBER +
          "?text=" + encodeURIComponent(buildWhatsappTableText(data, file));
        
        window.open(url, "_blank", "noopener");
      }
    });
  }
})();