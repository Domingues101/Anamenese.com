(function () {
  "use strict";

  const WHATSAPP_NUMBER = "5534998959051";

  const NIVEIS = {
    "Nunca treinei": "Nunca treinei",
    "Iniciante": "Iniciante",
    "Intermediário": "Intermediário",
    "Avançado": "Avançado",
    nunca: "Nunca treinei",
    iniciante: "Iniciante",
    intermediario: "Intermediário",
    avancado: "Avançado"
  };

  const formDiv = document.getElementById("anamnese");
  const cpfInput = document.getElementById("cpf");

  function formatDate(iso) {
    if (!iso) return "Não informada";
    const p = iso.split("-");
    if (p.length !== 3) return iso;
    return p[2] + "/" + p[1] + "/" + p[0];
  }

  function maskCpf(value) {
    if (!value) return "";
    const d = value.replace(/\D/g, "").slice(0, 11);
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2");
  }

  if (cpfInput) {
    cpfInput.addEventListener("input", () => {
      cpfInput.value = maskCpf(cpfInput.value);
    });
  }

  // SALVAMENTO AUTOMÁTICO (localStorage) PARA NÃO PERDER NADA AO SAIR DA PÁGINA
  if (formDiv) {
    formDiv.querySelectorAll("input, select, textarea").forEach(el => {
      const key = "anamnese_" + (el.id || el.name);
      
      // Carrega valor salvo anteriormente
      const savedValue = localStorage.getItem(key);
      if (savedValue !== null) {
        if (el.type === "checkbox" || el.type === "radio") {
          if (el.value === savedValue) el.checked = true;
        } else {
          el.value = savedValue;
        }
      }

      // Salva ao digitar ou selecionar
      const saveAction = () => {
        if (el.type === "checkbox" || el.type === "radio") {
          if (el.checked) localStorage.setItem(key, el.value);
        } else {
          localStorage.setItem(key, el.value);
        }
      };

      el.addEventListener("input", saveAction);
      el.addEventListener("change", saveAction);
    });
  }

  // Função global acionada pelo botão Finalizar Ficha e Enviar
  window.enviarFichaWhatsApp = function() {
    if (!formDiv) return;

    const nomeEl = formDiv.querySelector("#nome");
    const cpfEl = formDiv.querySelector("#cpf");
    const nascEl = formDiv.querySelector("#nascimento");
    const obsEl = formDiv.querySelector("#observacoes");
    const objEl = formDiv.querySelector("#objetivo");
    const freqSelect = formDiv.querySelector("#frequencia");

    const nome = nomeEl ? nomeEl.value.trim() : "Não informado";
    const cpf = cpfEl ? cpfEl.value : "Não informado";
    const nascimento = nascEl ? nascEl.value : "";
    const observacoes = obsEl ? obsEl.value.trim() : "Nenhuma";
    const objetivo = objEl ? objEl.value.trim() : "Não informado";

    // Modalidades selecionadas (checkboxes)
    const modalidades = Array.from(formDiv.querySelectorAll('input[name="modalidades"]:checked'))
      .map(i => i.nextElementSibling ? i.nextElementSibling.textContent : i.value)
      .join(", ") || "Nenhuma";

    // Frequência de treinos
    const freq = freqSelect && freqSelect.value
      ? freqSelect.options[freqSelect.selectedIndex].text
      : "Não informado";

    // Nível selecionado (radio)
    const nivelChecked = formDiv.querySelector('input[name="nivel"]:checked');
    const nivelRaw = nivelChecked ? nivelChecked.value : "nao_informado";
    const nivel = NIVEIS[nivelRaw] || nivelRaw;

    // Monta o texto para o WhatsApp incluindo o objetivo
    const textoMensagem = [
      "📋 *NOVA FICHA DE ANAMNESE*",
      "----------------------------------",
      "👤 *Nome:* " + (nome || "Não informado"),
      "🆔 *CPF:* " + (cpf || "Não informado"),
      "🎂 *Nascimento:* " + formatDate(nascimento),
      "⭐ *Nível:* " + nivel,
      "🏋️ *Modalidades:* " + modalidades,
      "📅 *Treinos/sem:* " + freq,
      "📝 *Observações:* " + observacoes,
      "🎯 *Objetivo:* " + objetivo,
      "----------------------------------",
      "📎 *Laudo:* Enviado via página de anexos"
    ].join("\n");

    if (WHATSAPP_NUMBER) {
      const url = "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(textoMensagem);
      window.open(url, "_blank", "noopener");
    }
  };
})();
