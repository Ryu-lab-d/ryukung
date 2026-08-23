/**
 * Google Apps Script Web App สำหรับรับข้อมูลจากสคริปต์ scripts/syncToSheets.ts แล้วเขียนทับแต่ละแท็บใน
 * Google Sheet ที่ผูกสคริปต์นี้ไว้ — วิธีติดตั้ง:
 *
 * 1. เปิด Google Sheet เป้าหมาย
 * 2. เมนู "ส่วนขยาย" (Extensions) → "Apps Script"
 * 3. ลบโค้ดตัวอย่างเดิมทิ้ง แล้ววางไฟล์นี้ทั้งหมดแทน
 * 4. กด "ทำให้ใช้งานได้" (Deploy) → "การทำให้ใช้งานได้แบบใหม่" (New deployment)
 *    - ประเภท (Type): "เว็บแอป" (Web app)
 *    - Execute as: Me
 *    - Who has access: Anyone (จำเป็น เพราะสคริปต์เรียกจากเครื่องโดยไม่ผ่าน OAuth — ตัวลิงก์เองคือรหัสลับ
 *      ห้ามแชร์ลิงก์นี้ให้ใครนอกจากเก็บไว้ใน .env.local)
 * 5. คัดลอก URL ของเว็บแอปที่ได้ ไปใส่ในไฟล์ .env.local ของโปรเจกต์เป็นค่า GOOGLE_SHEETS_SYNC_WEBHOOK_URL
 *
 * รูปแบบ payload ที่รับ (JSON): { sheetName: string, headers: string[], rows: (string|number)[][] }
 * ทุกครั้งที่เรียก จะล้างข้อมูลเดิมในแท็บนั้นทั้งหมดแล้วเขียนใหม่ทั้งชุด (ไม่ใช่การเพิ่มต่อท้าย)
 */
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var sheetName = payload.sheetName;
    var headers = payload.headers;
    var rows = payload.rows;

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) sheet = ss.insertSheet(sheetName);
    sheet.clear();

    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#1c1917')
      .setFontColor('#ffffff');

    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    }

    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);

    return ContentService.createTextOutput(JSON.stringify({ ok: true, rows: rows.length }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
