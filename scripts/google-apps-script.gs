/**
 * APNA CITY NEWS — Google Apps Script data layer
 * Sheet columns are created automatically by setupSheet().
 * Keep NEWS_API_SECRET in Script Properties; never put it in HTML.
 */
const HEADERS = ["id","title","category","summary","body","image","source","status","featured","breaking","author","createdAt","updatedAt"];
function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName("News");
  if (!sh) sh = ss.insertSheet("News");
  if (sh.getLastRow() === 0) sh.appendRow(HEADERS);
  else {
    const first = sh.getRange(1,1,1,Math.max(sh.getLastColumn(),HEADERS.length)).getValues()[0];
    if (String(first[0]) !== "id") throw new Error("Row 1 must be the standard ACN header row.");
  }
  return "News sheet ready";
}
function doGet() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("News");
  if (!sh || sh.getLastRow() < 2) return output({news:[]});
  const rows = sh.getDataRange().getValues();
  const headers = rows.shift();
  const news = rows.map(row => rowToObject(headers,row)).filter(n => n.title && String(n.status).toLowerCase() === "published").reverse();
  return output({news:news});
}
function doPost(e) {
  try {
    const p = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const secret = PropertiesService.getScriptProperties().getProperty("NEWS_API_SECRET");
    if (!secret || !constantTimeEqual(String(p.secret || ""), secret)) return output({ok:false,error:"Unauthorized"});
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("News");
    if (!sh) return output({ok:false,error:"Run setupSheet() first"});
    const rows = sh.getDataRange().getValues();
    const headers = rows[0];
    const records = rows.slice(1).map((r,i)=>({row:i+2,data:rowToObject(headers,r)}));
    if (p.action === "list") return output({ok:true,news:records.map(x=>x.data).reverse()});
    if (p.action === "delete") {
      const found = records.find(x=>String(x.data.id)===String(p.id));
      if (!found) return output({ok:false,error:"Record not found"});
      sh.deleteRow(found.row);
      return output({ok:true});
    }
    if (!["create","update"].includes(p.action)) return output({ok:false,error:"Invalid action"});
    const now = new Date().toISOString();
    const id = p.action === "create" ? Utilities.getUuid() : String(p.id || "");
    const found = records.find(x=>String(x.data.id)===id);
    if (p.action === "update" && !found) return output({ok:false,error:"Record not found"});
    const obj = {
      id:id,title:String(p.title||""),category:String(p.category||"local"),
      summary:String(p.summary||""),body:String(p.body||""),image:String(p.image||""),
      source:String(p.source||"نیوز ڈیسک"),status:String(p.status||"draft"),
      featured:p.featured===true,breaking:p.breaking===true,author:String(p.author||""),
      createdAt:found?found.data.createdAt:now,updatedAt:now
    };
    const values = HEADERS.map(h=>obj[h]===undefined?"":obj[h]);
    if (found) sh.getRange(found.row,1,1,HEADERS.length).setValues([values]);
    else sh.appendRow(values);
    return output({ok:true,id:id});
  } catch(err) { return output({ok:false,error:String(err && err.message || err)}); }
}
function rowToObject(headers,row) {
  const o={}; headers.forEach((h,i)=>o[String(h)]=row[i]);
  ["featured","breaking"].forEach(k=>o[k]=o[k]===true || String(o[k]).toLowerCase()==="true");
  ["createdAt","updatedAt"].forEach(k=>{if(o[k] instanceof Date)o[k]=o[k].toISOString();else o[k]=String(o[k]||"")});
  return o;
}
function output(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function constantTimeEqual(a,b) {
  if(a.length!==b.length)return false;
  let out=0;for(let i=0;i<a.length;i++)out|=a.charCodeAt(i)^b.charCodeAt(i);
  return out===0;
}
