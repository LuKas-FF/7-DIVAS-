
/**
 * ATELIÊ 7 DIVAS - SaaS BACKEND v2.1
 * Como instalar: 
 * 1. No Google Sheets: Extensões > Apps Script.
 * 2. Cole este código.
 * 3. Clique em "Implantar" > "Nova Implantação".
 * 4. Tipo: "App da Web", Executar como: "Você", Acesso: "Qualquer pessoa".
 */

const SS = SpreadsheetApp.getActiveSpreadsheet();

function doGet(e) {
  const action = e.parameter.action;
  if (action === 'getAllData') {
    const data = {
      users: getSheetData('USERS'),
      products: getSheetData('PRODUCTS'),
      transactions: getSheetData('TRANSACTIONS'),
      config: getSheetData('CONFIG')[0] || {},
      stores: getSheetData('STORES'),
      rawMaterials: getSheetData('RAW_MATERIALS')
    };
    return createJsonResponse(data);
  }
  return createJsonResponse({ status: 'active', message: 'API 7 Divas Online' });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    if (action === 'syncAll') {
      if (body.data.users) updateSheet('USERS', body.data.users);
      if (body.data.products) updateSheet('PRODUCTS', body.data.products);
      if (body.data.transactions) updateSheet('TRANSACTIONS', body.data.transactions);
      if (body.data.stores) updateSheet('STORES', body.data.stores);
      if (body.data.rawMaterials) updateSheet('RAW_MATERIALS', body.data.rawMaterials);
      if (body.data.config) updateSheet('CONFIG', [body.data.config]);
      
      return createJsonResponse({ success: true, timestamp: new Date().toISOString() });
    }
  } catch (err) {
    return createJsonResponse({ success: false, error: err.toString() });
  }
}

function getSheetData(name) {
  let sheet = SS.getSheetByName(name);
  if (!sheet) {
    sheet = SS.insertSheet(name);
    // Cria cabeçalhos básicos se a aba for nova
    if (name === 'PRODUCTS') sheet.appendRow(['id', 'sku', 'name', 'category', 'unit', 'costPrice', 'salePrice', 'minStock', 'currentStock', 'imageUrl']);
    if (name === 'USERS') sheet.appendRow(['id', 'name', 'email', 'password', 'role', 'status', 'avatar']);
    if (name === 'STORES') sheet.appendRow(['id', 'name', 'status']);
  }
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    let obj = {};
    headers.forEach((h, i) => {
      let val = row[i];
      // Tenta converter strings que deveriam ser números
      if (typeof val === 'string' && !isNaN(val) && val.trim() !== "") {
        if (h.toLowerCase().includes('price') || h.toLowerCase().includes('stock') || h.toLowerCase().includes('quantity')) {
          val = Number(val);
        }
      }
      obj[h] = val;
    });
    return obj;
  });
}

function updateSheet(name, data) {
  let sheet = SS.getSheetByName(name);
  if (!sheet) sheet = SS.insertSheet(name);
  sheet.clear();
  if (!data || data.length === 0) return;
  const headers = Object.keys(data[0]);
  sheet.appendRow(headers);
  const rows = data.map(item => headers.map(h => {
    const val = item[h];
    return (typeof val === 'object' && val !== null) ? JSON.stringify(val) : val;
  }));
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
