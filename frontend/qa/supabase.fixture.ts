// Synthetic, local-only design fixtures. Never imported by the production build.
export const isSupabaseConfigured = true;
const params = new URLSearchParams(location.search);
const scenario = params.get('state');
const role = params.get('role') || 'Admin';
const date = (offset = 0) => { const d = new Date(); d.setDate(d.getDate() - offset); return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-'); };
const productNames = ['PVC Electrical Conduit', 'Paint Roller', 'Auto Wire', 'PVC Coupling Reducer', 'Clean Out Plug', 'Hex Bolt', 'Barrel Bolt', 'Door Hinge', 'Steel Brush', 'Adjustable Wrench', 'Steel Drill Bit', 'Claw Hammer', 'Measuring Tape', 'Safety Gloves'];
const products = productNames.map((name,index) => ({ product_id:index+16, product_name:name, unit:'pcs', price:[30,95,35,25,15,12,45,65,75,320,110,275,150,85][index], stock:[53,4,20,2,45,140,34,26,3,12,28,15,18,0][index], reserved_stock: index===3?1:0, photo_path:null as string | null }));
if (scenario === 'stock-mismatch') { products[0].stock = -1; products[3].stock = 0; }
const customers = ['Patrick Dela Cruz', 'Marin Santos', 'Jay Reyes', 'Lopez Store', 'KB Builders'].map((name,index)=>({customer_id:index+1,name}));
const sales = Array.from({length:18},(_,i)=> {
 const p=products[i%13]; const customer=customers[i%5]; const day=date(i%7);
 return {sale_id:i+1,transaction_id:i<2?'d10c00b0-1234-5678-9012-123456789012':`d10c00b0-1234-5678-9012-${String(i).padStart(12,'0')}`,product_id:p.product_id,customer_id:customer.customer_id,quantity:(i%4)+1,total_amount:p.price*((i%4)+1),sale_date:day,created_at:day+'T10:15:00',products:{product_name:p.product_name,unit:p.unit},customers:{name:customer.name}};
});
const reservations=Array.from({length:15},(_,i)=>({reservation_id:i+1,customer_id:(i%5)+1,product_id:products[i%14].product_id,quantity:(i%3)+1,reservation_date:date(i%7),status:['Pending','Approved','Claimed','Cancelled'][i%4],products:{product_name:products[i%14].product_name,unit:'pcs'},customers:{name:customers[i%5].name}}));
const profiles=[{id:'qa-admin',name:'Admin',username:'admin',role},{id:'qa-manager',name:'Maria Santos',username:'maria',role:'Manager'},{id:'qa-cashier',name:'James Reyes',username:'james',role:'Cashier'}];
const db: Record<string, any[]> = {products,customers,sales,reservations,profiles};
const photoFiles: Record<string,string> = {};
if (scenario === 'photos') { products[0].photo_path = 'products/fixture-hardware.png'; photoFiles[products[0].photo_path] = '/hardware-workspace.png'; }
if (scenario === 'photo-load-error') products[0].photo_path = 'products/unavailable.png';
let signedIn = scenario !== 'login';
let listener: ((event:string,session:any)=>void) | null = null;
const session = () => signedIn ? {user:{id:'qa-admin',email:'admin@ireserve.local'}} : null;
class Query {
 table:string; filters: [string,unknown][] = []; head=false; one=false; orderBy=''; ascending=true; mutation:any=null; kind='';
 constructor(table:string){ this.table=table; }
 select(_fields?:string,options?:any){ this.head=!!options?.head; return this; }
 eq(key:string,value:unknown){ this.filters.push([key,value]); return this; }
 is(key:string,value:unknown){ this.filters.push([key,value]); return this; }
 order(key:string,options?:any){this.orderBy=key;this.ascending=options?.ascending!==false;return this;}
 single(){this.one=true;return this;} maybeSingle(){this.one=true;return this;}
 insert(value:any){this.kind='insert';this.mutation=Array.isArray(value)?value:[value];return this;}
 update(value:any){this.kind='update';this.mutation=value;return this;}
 delete(){this.kind='delete';return this;}
 in(){return this;} neq(){return this;}
 then(resolve:any,reject:any){
  return new Promise(done=>setTimeout(()=>{
    if(scenario==='error' && this.table!=='profiles') return done({data:null,error:{message:'Preview: connection unavailable. Please retry.'},count:0});
    let rows=scenario==='empty' && this.table!=='profiles'?[]:[...(db[this.table]||[])];
    rows=rows.filter(row=>this.filters.every(([key,value])=>row[key]===value));
    if (this.kind && this.table === 'products' && scenario === 'photo-save-error') return done({data:null,error:{code:'23514',message:'Preview: product save rejected.'}});
    if (this.kind && this.table === 'products' && scenario === 'photo-missing-column' && (this.mutation?.photo_path !== undefined || this.mutation?.[0]?.photo_path !== undefined)) return done({data:null,error:{code:'PGRST204',message:'Preview: photo_path not found.'}});
    if(this.kind==='insert') { const key={products:'product_id',customers:'customer_id',sales:'sale_id',reservations:'reservation_id',profiles:'id'}[this.table]||'id';const additions=this.mutation.map((row:any,index:number)=>({...row,[key]:100+db[this.table].length+index}));db[this.table].push(...additions); rows=additions; }
    if(this.kind==='update') rows.forEach(row=>Object.assign(row,this.mutation));
    if(this.kind==='delete') db[this.table]=db[this.table].filter(row=>!rows.includes(row));
    if(this.orderBy) rows.sort((a,b)=>String(a[this.orderBy]).localeCompare(String(b[this.orderBy]))*(this.ascending?1:-1));
    done({data:this.head?null:this.one?rows[0]||null:rows,count:rows.length,error:null});
  },60)).then(resolve,reject);
 }
}
const channel = {on(){return this;},subscribe(){return this;}};
export const supabase:any = {
 storage:{from:()=>({
   upload:async(path:string,file:File)=>{
     if (scenario === 'photo-upload-error') return {data:null,error:{message:'Preview: storage unavailable.'}};
     photoFiles[path] = await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(file);});
     return {data:{path},error:null};
   },
   remove:async(paths:string[])=>{paths.forEach(path=>delete photoFiles[path]);return {data:paths,error:null};},
   createSignedUrls:async(paths:string[])=>({data:paths.map(path=>({path,signedUrl:photoFiles[path],error:photoFiles[path]?null:'Not found'})),error:null}),
 })},
 from:(table:string)=>new Query(table),
 channel:()=>channel,removeChannel:()=>{},
 auth:{
  getSession:async()=>({data:{session:session()},error:null}),
  getUser:async()=>({data:{user:session()?.user},error:null}),
  onAuthStateChange:(cb:any)=>{listener=cb;return {data:{subscription:{unsubscribe(){listener=null;}}}};},
  signInWithPassword:async({password}:any)=>{if(password!=='preview-pass') return {error:{message:'Invalid credentials'}};signedIn=true;listener?.('SIGNED_IN',session());return {data:{session:session()},error:null};},
  signOut:async()=>{signedIn=false;listener?.('SIGNED_OUT',null);return {error:null};}
 },
 rpc:async(name:string)=>{
  if(name==='get_encryption_key') return {data:btoa(String.fromCharCode(...new Uint8Array(32).fill(7))),error:null};
  return {data:null,error:null};
 }
};
