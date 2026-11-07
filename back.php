<?php
/**
 * Recebe a ficha de anamnese e envia por e-mail, com o laudo em anexo.
 * Requer hospedagem com PHP (a função mail() precisa estar habilitada).
 */
 
// ===================== CONFIGURE AQUI =====================
$DESTINO   = "kallelmendes2@gmail.com";      // e-mail que vai RECEBER as fichas
$REMETENTE = "nao-responda@seudominio.com.br"; // e-mail do SEU domínio (evita cair no spam)
$ASSUNTO   = "Nova ficha de anamnese";
// ==========================================================
 
header("Content-Type: application/json; charset=utf-8");
 
function responder($ok, $mensagem, $codigo = 200) {
    http_response_code($codigo);
    echo json_encode(["ok" => $ok, "message" => $mensagem], JSON_UNESCAPED_UNICODE);
    exit;
}
 
function limpar($valor) {
    return trim(str_replace(["\r", "\n"], " ", (string)$valor));
}
 
function cpf_valido($cpf) {
    $cpf = preg_replace('/\D/', '', $cpf);
    if (strlen($cpf) !== 11 || preg_match('/^(\d)\1{10}$/', $cpf)) return false;
    for ($t = 9; $t < 11; $t++) {
        $soma = 0;
        for ($i = 0; $i < $t; $i++) $soma += $cpf[$i] * (($t + 1) - $i);
        $dig = ((10 * $soma) % 11) % 10;
        if ((int)$cpf[$t] !== $dig) return false;
    }
    return true;
}
 
if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    responder(false, "Método não permitido.", 405);
}
 
// Arquivo maior que o limite do servidor: o PHP descarta o $_POST inteiro
if (empty($_POST) && empty($_FILES)) {
    responder(false, "O arquivo é maior que o limite aceito pelo servidor.", 413);
}
 
/* ---------- Campos ---------- */
$nome       = limpar($_POST["nome"] ?? "");
$cpf        = limpar($_POST["cpf"] ?? "");
$nascimento = limpar($_POST["nascimento"] ?? "");
$nivel      = limpar($_POST["nivel"] ?? "");
$frequencia = limpar($_POST["frequencia"] ?? "");
$obs        = trim((string)($_POST["observacoes"] ?? ""));
$modalidades = isset($_POST["modalidades"]) && is_array($_POST["modalidades"])
    ? array_map("limpar", $_POST["modalidades"]) : [];
 
$niveis = [
    "nunca"         => "Nunca treinei",
    "iniciante"     => "Iniciante (até 6 meses)",
    "intermediario" => "Intermediário (6 meses a 2 anos)",
    "avancado"      => "Avançado (mais de 2 anos)",
];
 
if (count(preg_split('/\s+/', $nome)) < 2)          responder(false, "Informe o nome completo.", 422);
if (!cpf_valido($cpf))                              responder(false, "CPF inválido.", 422);
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $nascimento)) responder(false, "Data de nascimento inválida.", 422);
if (!isset($niveis[$nivel]))                        responder(false, "Escolha o nível de experiência.", 422);
 
/* ---------- Laudo ---------- */
if (!isset($_FILES["laudo"]) || $_FILES["laudo"]["error"] !== UPLOAD_ERR_OK) {
    $erro = $_FILES["laudo"]["error"] ?? UPLOAD_ERR_NO_FILE;
    if ($erro === UPLOAD_ERR_INI_SIZE || $erro === UPLOAD_ERR_FORM_SIZE) {
        responder(false, "O arquivo é maior que o limite aceito pelo servidor.", 413);
    }
    responder(false, "Envie o laudo médico em PDF ou Word.", 422);
}
 
$arq     = $_FILES["laudo"];
$ext     = strtolower(pathinfo($arq["name"], PATHINFO_EXTENSION));
$maximo  = 10 * 1024 * 1024;
 
if (!in_array($ext, ["pdf", "doc", "docx"], true)) responder(false, "Formato não aceito. Use PDF, DOC ou DOCX.", 422);
if ($arq["size"] > $maximo)                        responder(false, "O arquivo tem mais de 10 MB.", 422);
 
$conteudo = file_get_contents($arq["tmp_name"]);
$inicio   = substr($conteudo, 0, 4);
 
// Confere o conteúdo real do arquivo, não só a extensão
$confere =
    ($ext === "pdf"  && $inicio === "%PDF") ||
    ($ext === "docx" && substr($inicio, 0, 2) === "PK") ||
    ($ext === "doc"  && $inicio === "\xD0\xCF\x11\xE0");
if (!$confere) responder(false, "O arquivo não parece ser um PDF ou Word válido.", 422);
 
$mimes = [
    "pdf"  => "application/pdf",
    "doc"  => "application/msword",
    "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
$nomeAnexo = "laudo-" . preg_replace('/[^a-z0-9]+/i', "-", iconv("UTF-8", "ASCII//TRANSLIT", $nome)) . "." . $ext;
 
/* ---------- Corpo do e-mail ---------- */
$partes = explode("-", $nascimento);
$dataBR = $partes[2] . "/" . $partes[1] . "/" . $partes[0];
 
$texto  = "Nova ficha de anamnese\n";
$texto .= "======================\n\n";
$texto .= "Nome: $nome\n";
$texto .= "CPF: $cpf\n";
$texto .= "Nascimento: $dataBR\n";
$texto .= "Nível: " . $niveis[$nivel] . "\n";
$texto .= "Modalidades: " . ($modalidades ? implode(", ", $modalidades) : "Não informado") . "\n";
$texto .= "Treinos por semana: " . ($frequencia !== "" ? $frequencia : "Não informado") . "\n";
$texto .= "Observações: " . ($obs !== "" ? $obs : "Nenhuma") . "\n\n";
$texto .= "O laudo médico segue em anexo.\n";
 
/* ---------- Monta o e-mail com anexo (MIME) ---------- */
$limite = "==Anamnese_" . md5(uniqid((string)mt_rand(), true));
 
$cabecalhos  = "From: Ficha de Anamnese <$REMETENTE>\r\n";
$cabecalhos .= "MIME-Version: 1.0\r\n";
$cabecalhos .= "Content-Type: multipart/mixed; boundary=\"$limite\"\r\n";
 
$corpo  = "--$limite\r\n";
$corpo .= "Content-Type: text/plain; charset=UTF-8\r\n";
$corpo .= "Content-Transfer-Encoding: base64\r\n\r\n";
$corpo .= chunk_split(base64_encode($texto)) . "\r\n";
 
$corpo .= "--$limite\r\n";
$corpo .= "Content-Type: {$mimes[$ext]}; name=\"$nomeAnexo\"\r\n";
$corpo .= "Content-Transfer-Encoding: base64\r\n";
$corpo .= "Content-Disposition: attachment; filename=\"$nomeAnexo\"\r\n\r\n";
$corpo .= chunk_split(base64_encode($conteudo)) . "\r\n";
$corpo .= "--$limite--";
 
$assuntoCodificado = "=?UTF-8?B?" . base64_encode($ASSUNTO . " - " . $nome) . "?=";
 
if (!mail($DESTINO, $assuntoCodificado, $corpo, $cabecalhos)) {
    responder(false, "Não foi possível enviar o e-mail agora. Tente novamente.", 500);
}
 
responder(true, "Ficha enviada com sucesso.");