export interface FinanceAutomationStatus {
  configured: boolean;
  enabled: boolean;
  tokenPrefix: string | null;
  hasExcelPassword: boolean;
  endpointUrl: string;
  lastImportAt: string | null;
  lastImportFileName: string | null;
  lastImportStatus: 'success' | 'error' | null;
  lastImportSummary: string | null;
  lastImportError: string | null;
  updatedAt: string | null;
}

export const DEFAULT_GMAIL_DONE_LABEL = 'Binder-Finance-Imported';

export const DEFAULT_GMAIL_SEARCH_QUERY =
  'has:attachment newer_than:30d (뱅크샐러드 OR 가계부 OR banksalad) -label:Binder-Finance-Imported';

/** Build ready-to-paste Google Apps Script (Code.gs) that forwards Gmail attachments to Binder. */
export function buildBankSaladAppsScript(options: {
  endpointUrl: string;
  searchQuery?: string;
  doneLabel?: string;
}): string {
  const endpointLiteral = JSON.stringify(options.endpointUrl.trim());
  const doneLabelLiteral = JSON.stringify(options.doneLabel?.trim() || DEFAULT_GMAIL_DONE_LABEL);
  const searchQueryLiteral = JSON.stringify(
    options.searchQuery?.trim() || DEFAULT_GMAIL_SEARCH_QUERY,
  );

  return `var BINDER_IMPORT_URL = ${endpointLiteral};
var DONE_LABEL = ${doneLabelLiteral};
var GMAIL_SEARCH_QUERY = ${searchQueryLiteral};
var MAX_FILE_BYTES = 10 * 1024 * 1024;

function getOrCreateLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

/** Search Gmail for new BankSalad .xlsx/.csv attachments and upload to Binder. */
function syncBankSaladEmails() {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('BINDER_IMPORT_TOKEN');
  if (!token || !token.trim()) {
    throw new Error('스크립트 속성 BINDER_IMPORT_TOKEN을 먼저 설정해 주세요.');
  }

  var doneLabel = getOrCreateLabel_(DONE_LABEL);
  var threads = GmailApp.search(GMAIL_SEARCH_QUERY, 0, 10);
  Logger.log('검색된 스레드 수: ' + threads.length);

  for (var i = 0; i < threads.length; i++) {
    var thread = threads[i];
    var messages = thread.getMessages();
    var uploadedAny = false;
    var failedAny = false;

    for (var j = 0; j < messages.length; j++) {
      var attachments = messages[j].getAttachments({
        includeInlineImages: false,
        includeAttachments: true,
      });

      for (var k = 0; k < attachments.length; k++) {
        var attachment = attachments[k];
        var fileName = attachment.getName() || 'banksalad.xlsx';
        if (!/\\.(xlsx|csv)$/i.test(fileName)) {
          continue;
        }

        var bytes = attachment.getBytes();
        if (bytes.length > MAX_FILE_BYTES) {
          Logger.log('용량 초과(10MB)로 건너뜀: ' + fileName + ' (' + bytes.length + ' bytes)');
          failedAny = true;
          continue;
        }

        var payload = {
          fileName: fileName,
          fileBase64: Utilities.base64Encode(bytes),
          mode: 'commit',
        };

        var res = UrlFetchApp.fetch(BINDER_IMPORT_URL, {
          method: 'post',
          contentType: 'application/json',
          headers: {
            Authorization: 'Bearer ' + token.trim(),
          },
          payload: JSON.stringify(payload),
          muteHttpExceptions: true,
        });

        var code = res.getResponseCode();
        var bodyText = res.getContentText();
        if (code >= 200 && code < 300) {
          uploadedAny = true;
          Logger.log('반영 성공 [' + fileName + ']: ' + bodyText);
        } else {
          failedAny = true;
          Logger.log('반영 실패 [' + fileName + '] HTTP ' + code + ': ' + bodyText);
        }
      }
    }

    if (uploadedAny && !failedAny) {
      thread.addLabel(doneLabel);
    }
  }
}

/** Register twice-daily Asia/Seoul triggers at 12:00 and 23:00. */
function setupTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'syncBankSaladEmails') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger('syncBankSaladEmails')
    .timeBased()
    .everyDays(1)
    .atHour(12)
    .inTimezone('Asia/Seoul')
    .create();

  ScriptApp.newTrigger('syncBankSaladEmails')
    .timeBased()
    .everyDays(1)
    .atHour(23)
    .inTimezone('Asia/Seoul')
    .create();

  Logger.log('매일 12시 · 23시 (Asia/Seoul) 자동 실행 트리거를 등록했습니다.');
}
`;
}
