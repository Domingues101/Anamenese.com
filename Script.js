(function () {
  "use strict";
 
  // Envio por e-mail: arquivo PHP que recebe a ficha e o laudo.
  // O site precisa estar em uma hospedagem com PHP.
  var ENDPOINT = "enviar.php";
 
  // Opcional: WhatsApp usado só se ENDPOINT estiver vazio.
  // Formato: 55 + DDD + número, só dígitos (ex.: 5534999999999)
  var WHATSAPP_NUMBER = "";
 
  var MAX_SIZE = 10 * 1024 * 1024; // 10 MB
  var ALLOWED_EXT = ["pdf", "doc", "docx"];
 
  var NIVEIS = {
    nunca: "Nunca treinei",
    iniciante: "Iniciante (até 6 meses)",
    intermediario: "Intermediário (6 meses a 2 anos)",
    avancado: "Avançado (mais de 2 anos)"
  };
 
  var form = document.getElementById("anamnese");
  var cpfInput = document.getElementById("cpf");
  var fileInput = document.getElementById("laudo");
  var dropzone = document.getElementById("dropzone");
  var dzEmpty = document.getElementById("dz-empty");
  var dzFile = document.getElementById("dz-file");
  var statusEl = document.getElementById("status");
  var submitBtn = document.getElementById("enviar");
 
  /* ---------- Utilidades ---------- */
 
  function setError(name, message) {
    var el = form.querySelector('[data-error-for="' + name + '"]');
    if (!el) return;
    el.textContent = message || "";
    var field = el.closest(".field");
    if (field) field.classList.toggle("invalid", !!message);
  }
 
  function formatSize(bytes) {
    if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1).replace(".", ",") + " MB";
  }
 
  function getExt(name) {
    var i = name.lastIndexOf(".");
    return i === -1 ? "" : name.slice(i + 1).toLowerCase();
  }
 
  function formatDate(iso) {
    var p = iso.split("-");
    return p[2] + "/" + p[1] + "/" + p[0];
  }
 
  /* ---------- CPF ---------- */
 
  function maskCpf(value) {
    var d = value.replace(/\D/g, "").slice(0, 11);
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2");
  }
 
  function isValidCpf(value) {
    var cpf = value.replace(/\D/g, "");
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
 
    function digit(len) {
      var sum = 0;
      for (var i = 0; i < len; i++) sum += parseInt(cpf[i], 10) * (len + 1 - i);
      var r = (sum * 10) % 11;
      return r === 10 ? 0 : r;
    }
    return digit(9) === parseInt(cpf[9], 10) && digit(10) === parseInt(cpf[10], 10);
  }
 
  cpfInput.addEventListener("input", function () {
    cpfInput.value = maskCpf(cpfInput.value);
  });
 
  /* ---------- Upload do laudo ---------- */
 
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
    document.getElementById("file-name").textContent = file.name;
    document.getElementById("file-size").textContent = formatSize(file.size);
    document.getElementById("file-ext").textContent = getExt(file.name).toUpperCase();
    dzEmpty.hidden = true;
    dzFile.hidden = false;
    fileInput.style.pointerEvents = "none"; // permite clicar em "Remover"
  }
 
  function clearFile() {
    fileInput.value = "";
    dzEmpty.hidden = false;
    dzFile.hidden = true;
    fileInput.style.pointerEvents = "";
  }
 
  fileInput.addEventListener("change", function () {
    var file = fileInput.files[0];
    var error = file ? validateFile(file) : "";
    if (error) {
      clearFile();
      setError("laudo", error);
      return;
    }
    setError("laudo", "");
    if (file) showFile(file);
  });
 
  document.getElementById("file-remove").addEventListener("click", function () {
    clearFile();
    setError("laudo", "");
  });
 
  ["dragenter", "dragover"].forEach(function (evt) {
    dropzone.addEventListener(evt, function () { dropzone.classList.add("dragover"); });
  });
  ["dragleave", "drop"].forEach(function (evt) {
    dropzone.addEventListener(evt, function () { dropzone.classList.remove("dragover"); });
  });
 
  /* ---------- Validação do formulário ---------- */
 
  function validate() {
    var ok = true;
 
    var nome = form.nome.value.trim();
    if (nome.split(/\s+/).length < 2) {
      setError("nome", "Digite seu nome completo.");
      ok = false;
    } else setError("nome", "");
 
    if (!isValidCpf(form.cpf.value)) {
      setError("cpf", "CPF inválido. Confira os números digitados.");
      ok = false;
    } else setError("cpf", "");
 
    var nasc = form.nascimento.value;
    var hoje = new Date().toISOString().slice(0, 10);
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
 
    var fileError = validateFile(fileInput.files[0]);
    setError("laudo", fileError);
    if (fileError) ok = false;
 
    if (!form.consentimento.checked) {
      setError("consentimento", "Marque a autorização para enviar a ficha.");
      ok = false;
    } else setError("consentimento", "");
 
    return ok;
  }
 
  /* ---------- Mensagem do WhatsApp ---------- */
 
  function buildWhatsappText(data, file) {
    var modalidades = Array.prototype.map
      .call(form.querySelectorAll('input[name="modalidades"]:checked'), function (i) {
        return i.nextElementSibling.textContent;
      })
      .join(", ") || "Não informado";
 
    var freq = form.frequencia.value
      ? form.frequencia.options[form.frequencia.selectedIndex].text
      : "Não informado";
 
    var obs = (data.get("observacoes") || "").trim() || "Nenhuma";
 
    return [
      "*Ficha de anamnese*",
      "",
      "*Nome:* " + data.get("nome").trim(),
      "*CPF:* " + data.get("cpf"),
      "*Nascimento:* " + formatDate(data.get("nascimento")),
      "*Nível:* " + NIVEIS[data.get("nivel")],
      "*Modalidades:* " + modalidades,
      "*Treinos por semana:* " + freq,
      "*Observações:* " + obs,
      "",
      "Laudo médico: " + file.name + " (vou anexar nesta conversa)"
    ].join("\n");
  }
 
  /* ---------- Envio ---------- */
 
  function showStatus(type, message) {
    statusEl.className = "status " + type;
    statusEl.textContent = message;
  }
 
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    statusEl.className = "status";
    statusEl.textContent = "";
 
    if (!validate()) {
      var firstInvalid = form.querySelector(".field.invalid");
      if (firstInvalid) firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
 
    var data = new FormData(form);
    var file = fileInput.files[0];
 
    // Envio por e-mail (servidor com PHP)
    if (ENDPOINT) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Enviando…";
 
      fetch(ENDPOINT, { method: "POST", body: data })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (json) {
            if (!res.ok || json.ok === false) {
              throw new Error(json.message || "Falha no envio.");
            }
          });
        })
        .then(function () {
          showStatus("ok", "Ficha enviada. Seu profissional vai analisar o laudo e entrar em contato.");
          form.reset();
          clearFile();
        })
        .catch(function (err) {
          showStatus("fail", err.message && err.message !== "Failed to fetch"
            ? err.message
            : "Não foi possível enviar a ficha. Verifique sua conexão e tente de novo.");
        })
        .then(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = "Enviar ficha";
        });
      return;
    }
 
    // Envio pelo WhatsApp (se configurado)
    if (WHATSAPP_NUMBER) {
      var url = "https://wa.me/" + WHATSAPP_NUMBER +
        "?text=" + encodeURIComponent(buildWhatsappText(data, file));
      window.open(url, "_blank", "noopener");
      showStatus(
        "ok",
        "WhatsApp aberto com seus dados. Toque em enviar e depois anexe o laudo (" +
          file.name + ") na conversa."
      );
      return;
    }
 
    // Modo de teste: nada sai do navegador
    console.log("Dados da ficha:", Object.fromEntries(data.entries()));
    showStatus("ok", "Modo de teste: configure ENDPOINT ou WHATSAPP_NUMBER no script.js.");
  });
})();