/**
 * ==============================================
 * Google Apps Script - Bethel TrackHub Webhook
 * ==============================================
 *
 * COMO USAR:
 * 1. Abra sua planilha do Google Sheets
 * 2. Menu: Extensões → Apps Script
 * 3. Cole este código inteiro
 * 4. Substitua WEBHOOK_URL e WEBHOOK_SECRET abaixo
 * 5. Clique em "Salvar"
 * 6. Execute a função "criarGatilho" uma vez (clique em Executar)
 * 7. Autorize o script quando solicitado
 *
 * O script vai enviar automaticamente cada novo lead
 * para o TrackHub quando uma nova linha for adicionada.
 *
 * IMPORTANTE: As colunas da planilha devem ter estes headers (linha 1):
 * Nome | Email | Telefone | Renda | Cidade | Estado | Como Conheceu |
 * utm_source | utm_medium | utm_campaign | utm_content | utm_term |
 * fbclid | ad_name | campaign_name | adset_name | creative_type |
 * fbc | fbp | tracker_url | tracker_referrer
 *
 * (As colunas UTM são opcionais - só aparecem se o tracker.js
 *  preencher os hidden fields no formulário)
 */

// ======== CONFIGURAÇÃO ========
var WEBHOOK_URL = "https://SEU_DOMINIO/api/webhook/sheets";
var WEBHOOK_SECRET = "bethel-track-cron-secret-2026";
var SOURCE = "site-a"; // Identificador unico deste site/planilha (ex: "site-a", "site-b")
// ==============================

/**
 * Execute esta função UMA VEZ para criar o gatilho automático.
 * Menu: Executar → criarGatilho
 */
function criarGatilho() {
  // Remove gatilhos antigos
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction() === "onFormSubmit") {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Cria novo gatilho para quando o formulário submeter
  ScriptApp.newTrigger("onFormSubmit")
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onFormSubmit()
    .create();

  Logger.log("Gatilho criado com sucesso!");
}

/**
 * Gatilho automático - dispara quando uma nova resposta chega.
 */
function onFormSubmit(e) {
  try {
    var row = e.values;
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    var lead = {};
    var fieldMap = {
      "nome": "full_name",
      "name": "full_name",
      "nome completo": "full_name",
      "email": "email",
      "e-mail": "email",
      "telefone": "phone",
      "whatsapp": "phone",
      "celular": "phone",
      "renda": "monthly_income",
      "renda mensal": "monthly_income",
      "cidade": "city",
      "estado": "state",
      "uf": "state",
      "como conheceu": "how_found",
      "como nos conheceu": "how_found",
      // UTM fields (mapeamento direto)
      "utm_source": "utm_source",
      "utm_medium": "utm_medium",
      "utm_campaign": "utm_campaign",
      "utm_content": "utm_content",
      "utm_term": "utm_term",
      "fbclid": "fbclid",
      "ad_name": "ad_name",
      "campaign_name": "campaign_name",
      "adset_name": "adset_name",
      "creative_type": "creative_type",
      "fbc": "fbc",
      "fbp": "fbp",
      "tracker_url": "tracker_url",
      "tracker_referrer": "tracker_referrer"
    };

    headers.forEach(function(header, i) {
      var key = header.toString().toLowerCase().trim();
      var mappedKey = fieldMap[key] || key;
      if (row[i] && row[i] !== "") {
        lead[mappedKey] = row[i].toString().trim();
      }
    });

    // Adiciona source automaticamente
    lead.source = SOURCE;

    // Envia para o TrackHub
    if (lead.full_name && lead.email) {
      enviarParaTrackHub(lead);
    }
  } catch (error) {
    Logger.log("Erro no onFormSubmit: " + error.toString());
  }
}

/**
 * Envia lead para a API do TrackHub
 */
function enviarParaTrackHub(lead) {
  var options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "x-webhook-secret": WEBHOOK_SECRET
    },
    payload: JSON.stringify(lead),
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(WEBHOOK_URL, options);
  Logger.log("TrackHub response: " + response.getContentText());
  return response;
}

/**
 * Função para envio manual - envia TODOS os leads da planilha.
 * Útil para importar leads existentes.
 * Menu: Executar → enviarTodosLeads
 */
function enviarTodosLeads() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  var headers = data[0];

  var fieldMap = {
    "nome": "full_name",
    "name": "full_name",
    "nome completo": "full_name",
    "email": "email",
    "e-mail": "email",
    "telefone": "phone",
    "whatsapp": "phone",
    "celular": "phone",
    "renda": "monthly_income",
    "renda mensal": "monthly_income",
    "cidade": "city",
    "estado": "state",
    "uf": "state",
    "como conheceu": "how_found",
    "como nos conheceu": "how_found",
    "utm_source": "utm_source",
    "utm_medium": "utm_medium",
    "utm_campaign": "utm_campaign",
    "utm_content": "utm_content",
    "utm_term": "utm_term",
    "fbclid": "fbclid",
    "ad_name": "ad_name",
    "campaign_name": "campaign_name",
    "adset_name": "adset_name",
    "creative_type": "creative_type",
    "fbc": "fbc",
    "fbp": "fbp",
    "tracker_url": "tracker_url",
    "tracker_referrer": "tracker_referrer"
  };

  var leads = [];

  for (var i = 1; i < data.length; i++) {
    var lead = {};
    headers.forEach(function(header, j) {
      var key = header.toString().toLowerCase().trim();
      var mappedKey = fieldMap[key] || key;
      if (data[i][j] && data[i][j] !== "") {
        lead[mappedKey] = data[i][j].toString().trim();
      }
    });

    if (lead.full_name && lead.email) {
      lead.source = SOURCE;
      leads.push(lead);
    }
  }

  if (leads.length === 0) {
    Logger.log("Nenhum lead para enviar.");
    return;
  }

  // Envia em lotes de 50
  for (var b = 0; b < leads.length; b += 50) {
    var batch = leads.slice(b, b + 50);
    var options = {
      method: "post",
      contentType: "application/json",
      headers: { "x-webhook-secret": WEBHOOK_SECRET },
      payload: JSON.stringify(batch),
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(WEBHOOK_URL, options);
    Logger.log("Lote " + (b / 50 + 1) + ": " + response.getContentText());
  }

  Logger.log("Total enviado: " + leads.length + " leads");
}
