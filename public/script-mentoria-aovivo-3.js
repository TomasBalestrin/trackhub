// Cargos conhecidos que aparecem como SUFIXO em monthly_income quando a
// planilha mistura faturamento+cargo na mesma coluna.
// Ex: "Entre R$15.000 e R$30.000 Dono" → income: "Entre R$15.000 e R$30.000", position: "Dono"
var POSITION_SUFFIXES = [
  "Dono", "Sócio", "Socio", "Vendedor", "Colaborador",
  "CEO", "Gerente", "Diretor", "Gestor", "Empreendedor",
  "Profissional", "Funcionário", "Funcionario", "Autônomo", "Autonomo"
];

/**
 * Se `monthly_income` termina com um dos cargos conhecidos E `position` está
 * vazio, separa a string em duas. Muta o objeto.
 */
function splitIncomePosition(lead) {
  if (!lead || !lead.monthly_income || lead.position) return lead;
  var income = String(lead.monthly_income).trim();
  for (var i = 0; i < POSITION_SUFFIXES.length; i++) {
    var suffix = POSITION_SUFFIXES[i];
    var re = new RegExp("\\s+" + suffix + "\\s*$", "i");
    if (re.test(income)) {
      lead.position = suffix;
      lead.monthly_income = income.replace(re, "").trim();
      break;
    }
  }
  return lead;
}

// ======== CONFIGURAÇÃO - MENTORIA AO VIVO 3 ========
var WEBHOOK_URL = "https://bethel-track.vercel.app/api/webhook/sheets";
var WEBHOOK_SECRET = "bethel-track-cron-secret-2026";
var SOURCE = "mentoria-aovivo-3";
var PROCESSED_KEY = "processedRows_v2";
// ====================================================

/**
 * Execute esta função UMA VEZ para criar o gatilho automático.
 * Usa onChange (detecta novas linhas) ao invés de onFormSubmit (só Google Forms).
 * Menu: Executar → criarGatilho
 */
function criarGatilho() {
  // Remove gatilhos antigos
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    ScriptApp.deleteTrigger(trigger);
  });

  // Gatilho onChange - dispara quando qualquer mudança acontece na planilha
  ScriptApp.newTrigger("onSheetChange")
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onChange()
    .create();

  // Inicializar contador de linhas processadas
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var lastRow = sheet.getLastRow();
  PropertiesService.getScriptProperties().setProperty(PROCESSED_KEY, lastRow.toString());

  Logger.log("Gatilho onChange criado! Linhas atuais marcadas como processadas: " + lastRow);
}

/**
 * Gatilho automático - dispara quando a planilha muda.
 * Verifica se há novas linhas e envia apenas as novas.
 */
function onSheetChange(e) {
  try {
    // Só processar inserções de linhas
    if (e && e.changeType && e.changeType !== "INSERT_ROW" && e.changeType !== "EDIT" && e.changeType !== "OTHER") {
      return;
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var lastRow = sheet.getLastRow();
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    // Pegar última linha processada
    var props = PropertiesService.getScriptProperties();
    var lastProcessed = parseInt(props.getProperty(PROCESSED_KEY) || "1", 10);

    if (lastRow <= lastProcessed) {
      return; // Nenhuma linha nova
    }

    var fieldMap = {
      "name": "full_name",
      "nome": "full_name",
      "nome completo": "full_name",
      "email": "email",
      "e-mail": "email",
      "location": "monthly_income",
      "faturamento": "monthly_income",
      "renda": "monthly_income",
      "renda mensal": "monthly_income",
      "position": "position",
      "cargo": "position",
      "phone": "phone",
      "telefone": "phone",
      "whatsapp": "phone",
      "celular": "phone",
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
      "ad_id": "ad_id",
      "adset_id": "adset_id",
      "campaign_id": "campaign_id",
      "fbc": "fbc",
      "fbp": "fbp",
      "tracker_url": "tracker_url",
      "tracker_referrer": "tracker_referrer",
      "source": "source"
    };

    // Processar apenas novas linhas
    var newRowsStart = lastProcessed + 1;
    var numNewRows = lastRow - lastProcessed;
    var newData = sheet.getRange(newRowsStart, 1, numNewRows, sheet.getLastColumn()).getValues();

    var leads = [];
    for (var i = 0; i < newData.length; i++) {
      var lead = {};
      headers.forEach(function(header, j) {
        var key = header.toString().toLowerCase().trim();
        var mappedKey = fieldMap[key] || key;
        if (newData[i][j] && newData[i][j] !== "") {
          lead[mappedKey] = newData[i][j].toString().trim();
        }
      });

      lead.source = SOURCE;
      splitIncomePosition(lead);

      if (lead.full_name && lead.email) {
        leads.push(lead);
      }
    }

    if (leads.length > 0) {
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
        Logger.log("Enviado " + batch.length + " leads: " + response.getContentText());
      }
    }

    // Atualizar contador
    props.setProperty(PROCESSED_KEY, lastRow.toString());
    Logger.log("Processado até linha " + lastRow + ". Novos leads: " + leads.length);

  } catch (error) {
    Logger.log("Erro no onSheetChange: " + error.toString());
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
 * Envio manual - envia TODOS os leads da planilha.
 * Útil para importar leads existentes.
 * Menu: Executar → enviarTodosLeads
 */
function enviarTodosLeads() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  var headers = data[0];

  var fieldMap = {
    "name": "full_name",
    "nome": "full_name",
    "email": "email",
    "location": "monthly_income",
    "faturamento": "monthly_income",
    "position": "position",
    "phone": "phone",
    "telefone": "phone",
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
    "tracker_referrer": "tracker_referrer",
    "source": "source"
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
      splitIncomePosition(lead);
      leads.push(lead);
    }
  }

  if (leads.length === 0) {
    Logger.log("Nenhum lead para enviar.");
    return;
  }

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
    Logger.log("Lote " + (Math.floor(b / 50) + 1) + ": " + response.getContentText());
  }

  Logger.log("Total enviado: " + leads.length + " leads");
}
