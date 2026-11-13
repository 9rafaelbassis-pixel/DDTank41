"use strict";
/*
 * Restore copies of source .bak files in an EPHEMERAL GitHub Actions SQL Server.
 * Exports ONLY metadata and ItemTemplateInfo templates, never player rows.
 * Needs SQL_PASSWORD env + SQL Server at 127.0.0.1:1433 (see workflow).
 */
const fs=require("node:fs");
const path=require("node:path");
const sql=require("mssql");
const output=path.resolve(process.env.OUTPUT_DIR||"migration-output/github-sql-lab");
const jobs=[
 {file:"Db_Membership.bak",database:"DDTankImportMembership"},
 {file:"Game34.bak",database:"DDTankImportGame"},
 {file:"Player34.bak",database:"DDTankImportPlayer"}
];
const quoted=(text)=>"N'"+String(text).replaceAll("'","''")+"'";
const id=(text)=>"["+String(text).replaceAll("]","]]")+"]";
function out(name,data){fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,name),JSON.stringify(data,null,2)+"\n")}
async function restore(pool,job) {
 const source="/var/opt/mssql/backups/"+job.file;
 const result=await pool.request().query("RESTORE FILELISTONLY FROM DISK="+quoted(source));
 if(!result.recordset.length)throw Error("Backup sem arquivos lógicos");
 const moves=result.recordset.map((row,index)=>{
   const isLog=row.Type==="L";
   const suffix=isLog?".ldf":(index===0?".mdf":".ndf");
   const target="/var/opt/mssql/data/"+job.database+"_"+index+suffix;
   return "MOVE "+quoted(row.LogicalName)+" TO "+quoted(target);
 });
 const command="RESTORE DATABASE "+id(job.database)+" FROM DISK="+quoted(source)+
  " WITH "+moves.join(", ")+", RECOVERY, STATS=25";
 const request=pool.request();request.timeout=300000;
 await request.batch(command);
 return {database:job.database,backup:job.file,files:result.recordset.length,restored:true};
}
async function schema(pool,database) {
 const query="SELECT TABLE_SCHEMA as table_schema,TABLE_NAME as table_name,COLUMN_NAME as column_name,DATA_TYPE as data_type FROM "+id(database)+".INFORMATION_SCHEMA.COLUMNS ORDER BY TABLE_SCHEMA,TABLE_NAME,ORDINAL_POSITION";
 const result=await pool.request().query(query);
 return result.recordset.map(row=>({database,...row}));
}
function normalize(row){
 const n=v=>{const x=Number(v??0);return Number.isInteger(x)&&x>=-2147483648&&x<=2147483647?x:0};
 const id=n(row.TemplateID);
 const name=String(row.Name??"").trim().slice(0,150);
 if(!id||!name)return null;
 return {TemplateID:id,Name:name,CategoryID:n(row.CategoryID),Pic:String(row.Pic??"").slice(0,256),
  Attack:n(row.Attack),Defence:n(row.Defence),Agility:n(row.Agility),Luck:n(row.Luck),Quality:n(row.Quality)};
}
async function exportGoods(pool,database) {
 const found=await pool.request().query("SELECT 1 AS found FROM "+id(database)+".sys.procedures WHERE name='SP_Items_All'");
 if(!found.recordset.length)return null;
 const result=await pool.request().query("EXEC "+id(database)+".dbo.SP_Items_All");
 const values=result.recordset.map(normalize).filter(Boolean);
 for(let at=0;at<values.length;at+=75){
  const index=String(1+at/75).padStart(4,"0");
  out("catalog-"+index+".json",values.slice(at,at+75));
 }
 return {database,templates:values.length,batches:Math.ceil(values.length/75)};
}
async function main(){
 if(!process.env.SQL_PASSWORD)throw Error("SQL_PASSWORD env missing");
 const pool=await new sql.ConnectionPool({
  server:"127.0.0.1",port:1433,user:"sa",password:process.env.SQL_PASSWORD,database:"master",
  options:{encrypt:false,trustServerCertificate:true},connectionTimeout:20000,requestTimeout:300000,pool:{max:2}
 }).connect();
 const report={note:"Only schema columns and item templates; no player rows or secrets.",restores:[],exports:[],issues:[]};
 try {
  for(const job of jobs){
   try{report.restores.push(await restore(pool,job));}
   catch(err){report.issues.push({backup:job.file,error:String(err.message).slice(0,700)})}
  }
  const schemas=[];
  for(const item of report.restores){
   try{
    schemas.push(...await schema(pool,item.database));
    const result=await exportGoods(pool,item.database);
    if(result)report.exports.push(result);
   }catch(err){report.issues.push({database:item.database,error:String(err.message).slice(0,700)})}
  }
  out("schema-metadata.json",schemas);
  out("report.json",report);
  console.log(JSON.stringify({restored:report.restores.length,sourceCatalogs:report.exports.length,issues:report.issues.length}));
  if(!report.restores.length)process.exitCode=1;
 } finally{await pool.close()}
}
main().catch(err=>{console.error("SQL lab failed: "+String(err.message).slice(0,500));process.exitCode=1});
