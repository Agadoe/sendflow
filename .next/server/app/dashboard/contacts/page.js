(()=>{var e={};e.id=5980,e.ids=[5980],e.modules={2934:e=>{"use strict";e.exports=require("next/dist/client/components/action-async-storage.external.js")},4580:e=>{"use strict";e.exports=require("next/dist/client/components/request-async-storage.external.js")},5869:e=>{"use strict";e.exports=require("next/dist/client/components/static-generation-async-storage.external.js")},399:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},6109:(e,t,s)=>{"use strict";s.r(t),s.d(t,{GlobalError:()=>i.a,__next_app__:()=>m,originalPathname:()=>h,pages:()=>c,routeModule:()=>p,tree:()=>d}),s(6934),s(2834),s(2029),s(5866);var a=s(3191),r=s(8716),o=s(7922),i=s.n(o),n=s(5231),l={};for(let e in n)0>["default","tree","pages","GlobalError","originalPathname","__next_app__","routeModule"].indexOf(e)&&(l[e]=()=>n[e]);s.d(t,l);let d=["",{children:["dashboard",{children:["contacts",{children:["__PAGE__",{},{page:[()=>Promise.resolve().then(s.bind(s,6934)),"/Users/admin/whatsapp-saas/src/app/dashboard/contacts/page.tsx"]}]},{}]},{layout:[()=>Promise.resolve().then(s.bind(s,2834)),"/Users/admin/whatsapp-saas/src/app/dashboard/layout.tsx"]}]},{layout:[()=>Promise.resolve().then(s.bind(s,2029)),"/Users/admin/whatsapp-saas/src/app/layout.tsx"],"not-found":[()=>Promise.resolve().then(s.t.bind(s,5866,23)),"next/dist/client/components/not-found-error"]}],c=["/Users/admin/whatsapp-saas/src/app/dashboard/contacts/page.tsx"],h="/dashboard/contacts/page",m={require:s,loadChunk:()=>Promise.resolve()},p=new a.AppPageRouteModule({definition:{kind:r.x.APP_PAGE,page:"/dashboard/contacts/page",pathname:"/dashboard/contacts",bundlePath:"",filename:"",appPaths:[]},userland:{loaderTree:d}})},2120:(e,t,s)=>{Promise.resolve().then(s.t.bind(s,2994,23)),Promise.resolve().then(s.t.bind(s,6114,23)),Promise.resolve().then(s.t.bind(s,9727,23)),Promise.resolve().then(s.t.bind(s,9671,23)),Promise.resolve().then(s.t.bind(s,1868,23)),Promise.resolve().then(s.t.bind(s,4759,23))},4279:(e,t,s)=>{Promise.resolve().then(s.bind(s,6826))},9788:(e,t,s)=>{Promise.resolve().then(s.bind(s,7022))},4827:()=>{},6826:(e,t,s)=>{"use strict";s.r(t),s.d(t,{default:()=>i});var a=s(326),r=s(7577),o=s(381);function i(){let[e,t]=(0,r.useState)([]),[s,i]=(0,r.useState)(!0),[n,l]=(0,r.useState)(!1),[d,c]=(0,r.useState)(!1),[h,m]=(0,r.useState)([]),[p,u]=(0,r.useState)([]),[x,f]=(0,r.useState)(0),[b,g]=(0,r.useState)(-1),v=(0,r.useRef)(null);async function y(){try{let e=await fetch("/api/contacts"),s=await e.json();t(s.contacts||[])}catch{o.default.error("Failed to load contacts")}finally{i(!1)}}function j(e){let t=e.target.files?.[0];if(!t)return;let s=new FileReader;s.onload=e=>{let t=(e.target?.result).split("\n").map(e=>{let t=[],s="",a=!1;for(let r of e)'"'===r?a=!a:","!==r||a?s+=r:(t.push(s.trim()),s="");return t.push(s.trim()),t}).filter(e=>e.some(e=>e));if(t.length<2){o.default.error("CSV must have at least a header row and 1 data row");return}u(t[0]),m(t.slice(1)),l(!0)},s.readAsText(t)}async function w(){if(0!==h.length){c(!0);try{let e=h.map(e=>({phone:e[x]?.replace(/\D/g,"")||"",name:b>=0&&e[b]||void 0})).filter(e=>e.phone.length>=9),t=await fetch("/api/contacts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contacts:e})}),s=await t.json();t.ok?(o.default.success(`Imported ${s.count} contacts!`),l(!1),y()):o.default.error(s.error||"Import failed")}finally{c(!1)}}}async function k(s){confirm("Delete this contact?")&&(await fetch(`/api/contacts/${s}`,{method:"DELETE"}).catch(()=>{}),t(e.filter(e=>e.id!==s)),o.default.success("Contact deleted"))}return(0,a.jsxs)("div",{className:"max-w-4xl space-y-6",children:[(0,a.jsxs)("div",{className:"flex items-center justify-between",children:[(0,a.jsxs)("div",{children:[a.jsx("h1",{className:"font-heading text-2xl text-slate",children:"Contacts"}),(0,a.jsxs)("p",{className:"text-sm text-slate-light mt-0.5",children:[e.length," contact",1!==e.length?"s":""]})]}),(0,a.jsxs)("div",{className:"flex gap-3",children:[(0,a.jsxs)("label",{className:"flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-slate text-sm font-medium px-4 py-2.5 rounded-btn cursor-pointer transition-colors",children:[a.jsx("svg",{className:"w-4 h-4",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:a.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"})}),"Import CSV",a.jsx("input",{ref:v,type:"file",accept:".csv,.txt",className:"hidden",onChange:j})]}),(0,a.jsxs)("button",{onClick:()=>l(!0),className:"flex items-center gap-2 bg-amber hover:bg-amber-dark text-white text-sm font-semibold px-4 py-2.5 rounded-btn transition-colors",children:[a.jsx("svg",{className:"w-4 h-4",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:a.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M12 4v16m8-8H4"})}),"Add Manually"]})]})]}),s?a.jsx("div",{className:"text-center py-12 text-slate-light",children:"Loading..."}):0===e.length?(0,a.jsxs)("div",{className:"bg-surface rounded-card border border-gray-100 p-12 text-center",children:[a.jsx("div",{className:"text-5xl mb-4",children:"\uD83D\uDC65"}),a.jsx("h3",{className:"font-heading text-xl text-slate mb-2",children:"No contacts yet"}),a.jsx("p",{className:"text-slate-light mb-6",children:"Import a CSV or add contacts one by one to get started."}),(0,a.jsxs)("label",{className:"inline-block bg-amber hover:bg-amber-dark text-white font-semibold px-6 py-3 rounded-btn cursor-pointer transition-colors",children:["Import CSV",a.jsx("input",{type:"file",accept:".csv,.txt",className:"hidden",onChange:j})]})]}):a.jsx("div",{className:"bg-surface rounded-card border border-gray-100 overflow-hidden",children:(0,a.jsxs)("table",{className:"w-full",children:[a.jsx("thead",{children:(0,a.jsxs)("tr",{className:"border-b border-gray-100 bg-gray-50/50",children:[a.jsx("th",{className:"text-left px-6 py-3 text-xs font-semibold text-slate-light uppercase tracking-wider",children:"Name"}),a.jsx("th",{className:"text-left px-6 py-3 text-xs font-semibold text-slate-light uppercase tracking-wider",children:"Phone"}),a.jsx("th",{className:"text-left px-6 py-3 text-xs font-semibold text-slate-light uppercase tracking-wider",children:"Tags"}),a.jsx("th",{className:"text-left px-6 py-3 text-xs font-semibold text-slate-light uppercase tracking-wider",children:"Added"}),a.jsx("th",{className:"px-6 py-3"})]})}),a.jsx("tbody",{className:"divide-y divide-gray-50",children:e.map(e=>{let t=JSON.parse(e.tags||"[]");return(0,a.jsxs)("tr",{className:"hover:bg-gray-50/50 transition-colors",children:[a.jsx("td",{className:"px-6 py-4 text-sm font-medium text-slate",children:e.name||"—"}),a.jsx("td",{className:"px-6 py-4 text-sm text-slate font-mono",children:e.phone}),a.jsx("td",{className:"px-6 py-4",children:a.jsx("div",{className:"flex gap-1 flex-wrap",children:t.map(e=>a.jsx("span",{className:"text-xs bg-amber/10 text-amber px-2 py-0.5 rounded-full",children:e},e))})}),a.jsx("td",{className:"px-6 py-4 text-xs text-slate-light",children:new Date(e.createdAt).toLocaleDateString()}),a.jsx("td",{className:"px-6 py-4",children:a.jsx("button",{onClick:()=>k(e.id),className:"text-slate-light hover:text-red-500 transition-colors",children:a.jsx("svg",{className:"w-4 h-4",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:a.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"})})})})]},e.id)})})]})}),n&&a.jsx("div",{className:"fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm",children:(0,a.jsxs)("div",{className:"bg-surface rounded-card w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto",children:[(0,a.jsxs)("div",{className:"flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-surface",children:[a.jsx("h3",{className:"font-heading text-xl text-slate",children:"Import Contacts"}),a.jsx("button",{onClick:()=>l(!1),className:"text-slate-light hover:text-slate",children:a.jsx("svg",{className:"w-5 h-5",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:a.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M6 18L18 6M6 6l12 12"})})})]}),a.jsx("div",{className:"p-6",children:h.length>0?(0,a.jsxs)("div",{className:"space-y-4",children:[(0,a.jsxs)("div",{className:"grid grid-cols-2 gap-4",children:[(0,a.jsxs)("div",{children:[a.jsx("label",{className:"block text-sm font-medium text-slate mb-1",children:"Phone column *"}),a.jsx("select",{value:x,onChange:e=>f(Number(e.target.value)),className:"w-full px-3 py-2 rounded-btn border border-gray-200 text-slate",children:p.map((e,t)=>a.jsx("option",{value:t,children:e||`Column ${t+1}`},t))})]}),(0,a.jsxs)("div",{children:[a.jsx("label",{className:"block text-sm font-medium text-slate mb-1",children:"Name column (optional)"}),(0,a.jsxs)("select",{value:b,onChange:e=>g(Number(e.target.value)),className:"w-full px-3 py-2 rounded-btn border border-gray-200 text-slate",children:[a.jsx("option",{value:-1,children:"— None"}),p.map((e,t)=>a.jsx("option",{value:t,children:e||`Column ${t+1}`},t))]})]})]}),a.jsx("div",{className:"bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm",children:(0,a.jsxs)("span",{className:"font-semibold text-green-700",children:[h.length," rows ready to import"]})}),(0,a.jsxs)("div",{className:"border border-gray-100 rounded-lg overflow-hidden overflow-x-auto",children:[(0,a.jsxs)("table",{className:"w-full text-xs",children:[a.jsx("thead",{className:"bg-gray-50",children:a.jsx("tr",{children:p.map((e,t)=>a.jsx("th",{className:"px-3 py-2 text-left text-slate-light font-medium whitespace-nowrap border-r border-gray-100",children:e||`Col ${t+1}`},t))})}),a.jsx("tbody",{children:h.slice(0,5).map((e,t)=>a.jsx("tr",{className:"border-t border-gray-50",children:e.map((e,t)=>a.jsx("td",{className:`px-3 py-2 whitespace-nowrap border-r border-gray-50 ${t===x?"bg-amber/5 font-semibold":""}`,children:e},t))},t))})]}),h.length>5&&(0,a.jsxs)("div",{className:"px-3 py-2 text-xs text-slate-light bg-gray-50",children:["+ ",h.length-5," more rows"]})]}),(0,a.jsxs)("div",{className:"flex gap-3",children:[a.jsx("button",{onClick:()=>{m([]),u([])},className:"flex-1 py-2.5 rounded-btn bg-gray-100 hover:bg-gray-200 text-slate font-medium transition-colors",children:"Back"}),(0,a.jsxs)("button",{onClick:w,disabled:d,className:"flex-1 py-2.5 rounded-btn bg-amber hover:bg-amber-dark text-white font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2",children:[d?a.jsx("span",{className:"w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"}):null,d?`Importing ${h.length}...`:`Import ${h.length} Contacts`]})]})]}):a.jsx("div",{className:"space-y-4",children:(0,a.jsxs)("div",{className:"border-2 border-dashed border-gray-200 rounded-xl p-12 text-center hover:border-amber/50 transition-colors",children:[a.jsx("div",{className:"text-4xl mb-3",children:"\uD83D\uDCC1"}),a.jsx("div",{className:"text-slate font-medium mb-1",children:"Drop your CSV or Excel file here"}),a.jsx("div",{className:"text-sm text-slate-light mb-4",children:"CSV with headers: Name, Phone (required)"}),(0,a.jsxs)("label",{className:"inline-block bg-amber hover:bg-amber-dark text-white font-semibold px-6 py-2.5 rounded-btn cursor-pointer transition-colors",children:["Browse Files",a.jsx("input",{type:"file",accept:".csv,.txt",className:"hidden",onChange:j})]})]})})})]})})]})}},7022:(e,t,s)=>{"use strict";s.r(t),s.d(t,{default:()=>l});var a=s(326),r=s(7577),o=s(434),i=s(5047);let n=[{label:"Dashboard",href:"/dashboard",icon:a.jsx("svg",{className:"w-5 h-5",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:a.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"})})},{label:"Drip Queue",href:"/dashboard/drip-queue",icon:a.jsx("svg",{className:"w-5 h-5",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:a.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"})})},{label:"Settings",href:"/dashboard/settings",icon:(0,a.jsxs)("svg",{className:"w-5 h-5",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:[a.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"}),a.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M15 12a3 3 0 11-6 0 3 3 0 016 0z"})]})},{label:"Forms",href:"/dashboard/forms",icon:a.jsx("svg",{className:"w-5 h-5",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:a.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"})})},{label:"Pipeline",href:"/dashboard/pipeline",icon:a.jsx("svg",{className:"w-5 h-5",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:a.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"})})},{label:"Analytics",href:"/dashboard/analytics",icon:a.jsx("svg",{className:"w-5 h-5",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:a.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"})})},{label:"Campaigns",href:"/dashboard/campaigns",icon:a.jsx("svg",{className:"w-5 h-5",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:a.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"})})},{label:"Contacts",href:"/dashboard/contacts",icon:a.jsx("svg",{className:"w-5 h-5",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:a.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"})})},{label:"Drip Queue",href:"/dashboard/drip-queue",icon:a.jsx("svg",{className:"w-5 h-5",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:a.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"})})},{label:"Connect WhatsApp",href:"/dashboard/connect",icon:a.jsx("svg",{className:"w-5 h-5",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:a.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"})})},{label:"Waitlist",href:"/dashboard/waitlist",icon:a.jsx("svg",{className:"w-5 h-5",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:a.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"})})}];function l({children:e}){let t=(0,i.usePathname)(),s=(0,i.useRouter)(),[l,d]=(0,r.useState)(!1),[c,h]=(0,r.useState)(null);async function m(){await fetch("/api/auth/logout",{method:"POST"}),s.push("/login"),s.refresh()}let p=c?.plan==="FREE"?"Free Plan":c?.plan==="STARTER"?"Starter Plan":c?.plan==="GROWTH"?"Growth Plan":c?.plan==="PRO"?"Pro Plan":"Free Plan",u=c?.name?.charAt(0).toUpperCase()||"U";return(0,a.jsxs)("div",{className:"min-h-screen bg-cream flex",children:[(0,a.jsxs)("aside",{className:`fixed inset-y-0 left-0 z-40 w-64 bg-slate text-white transform transition-transform duration-200 ${l?"translate-x-0":"-translate-x-full"} md:translate-x-0 md:static`,children:[(0,a.jsxs)("div",{className:"flex items-center gap-3 px-6 py-5 border-b border-white/10",children:[a.jsx("div",{className:"w-8 h-8 rounded-lg bg-amber flex items-center justify-center",children:(0,a.jsxs)("svg",{width:"18",height:"18",viewBox:"0 0 24 24",fill:"white",children:[a.jsx("path",{d:"M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"}),a.jsx("path",{d:"M12 0C5.373 0 0 5.373 0 12c0 2.11.547 4.11 1.497 5.84L0 24l6.335-1.663A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"})]})}),(0,a.jsxs)("div",{children:[a.jsx("div",{className:"font-heading text-lg",children:"SendFlow"}),a.jsx("div",{className:"text-xs text-gray-400",children:"Business Dashboard"})]})]}),a.jsx("nav",{className:"px-3 py-4 space-y-1",children:n.map(e=>{let s=t===e.href;return(0,a.jsxs)(o.default,{href:e.href,className:`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${s?"bg-amber text-white":"text-gray-300 hover:bg-white/10"}`,children:[e.icon,e.label]},e.href)})}),a.jsx("div",{className:"absolute bottom-0 left-0 right-0 px-4 py-4 border-t border-white/10",children:(0,a.jsxs)("div",{className:"flex items-center gap-3",children:[a.jsx("div",{className:"w-8 h-8 rounded-full bg-amber/20 flex items-center justify-center text-amber text-sm font-bold",children:u}),(0,a.jsxs)("div",{className:"flex-1 min-w-0",children:[a.jsx("div",{className:"text-sm font-medium truncate",children:c?.name||"Loading..."}),a.jsx("div",{className:"text-xs text-gray-400 truncate",children:p})]}),a.jsx("button",{onClick:m,className:"text-gray-400 hover:text-white transition-colors",title:"Sign out",children:a.jsx("svg",{className:"w-4 h-4",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:a.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"})})})]})})]}),l&&a.jsx("div",{className:"fixed inset-0 z-30 bg-black/50 md:hidden",onClick:()=>d(!1)}),(0,a.jsxs)("div",{className:"flex-1 flex flex-col min-w-0",children:[(0,a.jsxs)("header",{className:"sticky top-0 z-30 bg-cream/90 backdrop-blur-md border-b border-gray-200 px-4 md:px-8 h-16 flex items-center justify-between",children:[a.jsx("button",{className:"md:hidden p-2 -ml-2 text-slate",onClick:()=>d(!0),children:a.jsx("svg",{className:"w-6 h-6",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:a.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M4 6h16M4 12h16M4 18h16"})})}),a.jsx("div",{className:"text-sm text-slate-light hidden md:block",children:"Dashboard"}),(0,a.jsxs)("div",{className:"flex items-center gap-3",children:[a.jsx("span",{className:"text-xs bg-amber/10 text-amber px-2.5 py-1 rounded-pill font-medium",children:p}),a.jsx(o.default,{href:"/",className:"text-xs text-slate-light hover:text-slate transition-colors",children:"← Landing"})]})]}),a.jsx("main",{className:"flex-1 p-4 md:p-8",children:e})]})]})}},6934:(e,t,s)=>{"use strict";s.r(t),s.d(t,{default:()=>a});let a=(0,s(8570).createProxy)(String.raw`/Users/admin/whatsapp-saas/src/app/dashboard/contacts/page.tsx#default`)},2834:(e,t,s)=>{"use strict";s.r(t),s.d(t,{default:()=>a});let a=(0,s(8570).createProxy)(String.raw`/Users/admin/whatsapp-saas/src/app/dashboard/layout.tsx#default`)},2029:(e,t,s)=>{"use strict";s.r(t),s.d(t,{default:()=>o,metadata:()=>r});var a=s(9510);s(5023);let r={title:"SendFlow — Bulk WhatsApp Marketing for African SMBs",description:"Reach thousands of customers instantly. Reliable delivery, real-time reports. From $29/month.",keywords:"WhatsApp marketing, bulk messaging, African SMB, Ghana business, WhatsApp business"};function o({children:e}){return a.jsx("html",{lang:"en",children:a.jsx("body",{children:e})})}},5023:()=>{},381:(e,t,s)=>{"use strict";s.d(t,{Toaster:()=>ec,default:()=>eh});var a,r=s(7577);let o={data:""},i=e=>{if("object"==typeof window){let t=(e?e.querySelector("#_goober"):window._goober)||Object.assign(document.createElement("style"),{innerHTML:" ",id:"_goober"});return t.nonce=window.__nonce__,t.parentNode||(e||document.head).appendChild(t),t.firstChild}return e||o},n=/(?:([\u0080-\uFFFF\w-%@]+) *:? *([^{;]+?);|([^;}{]*?) *{)|(}\s*)/g,l=/\/\*[^]*?\*\/|  +/g,d=/\n+/g,c=(e,t)=>{let s="",a="",r="";for(let o in e){let i=e[o];"@"==o[0]?"i"==o[1]?s=o+" "+i+";":a+="f"==o[1]?c(i,o):o+"{"+c(i,"k"==o[1]?"":t)+"}":"object"==typeof i?a+=c(i,t?t.replace(/([^,])+/g,e=>o.replace(/([^,]*:\S+\([^)]*\))|([^,])+/g,t=>/&/.test(t)?t.replace(/&/g,e):e?e+" "+t:t)):o):null!=i&&(o=/^--/.test(o)?o:o.replace(/[A-Z]/g,"-$&").toLowerCase(),r+=c.p?c.p(o,i):o+":"+i+";")}return s+(t&&r?t+"{"+r+"}":r)+a},h={},m=e=>{if("object"==typeof e){let t="";for(let s in e)t+=s+m(e[s]);return t}return e},p=(e,t,s,a,r)=>{let o=m(e),i=h[o]||(h[o]=(e=>{let t=0,s=11;for(;t<e.length;)s=101*s+e.charCodeAt(t++)>>>0;return"go"+s})(o));if(!h[i]){let t=o!==e?e:(e=>{let t,s,a=[{}];for(;t=n.exec(e.replace(l,""));)t[4]?a.shift():t[3]?(s=t[3].replace(d," ").trim(),a.unshift(a[0][s]=a[0][s]||{})):a[0][t[1]]=t[2].replace(d," ").trim();return a[0]})(e);h[i]=c(r?{["@keyframes "+i]:t}:t,s?"":"."+i)}let p=s&&h.g?h.g:null;return s&&(h.g=h[i]),((e,t,s,a)=>{a?t.data=t.data.replace(a,e):-1===t.data.indexOf(e)&&(t.data=s?e+t.data:t.data+e)})(h[i],t,a,p),i},u=(e,t,s)=>e.reduce((e,a,r)=>{let o=t[r];if(o&&o.call){let e=o(s),t=e&&e.props&&e.props.className||/^go/.test(e)&&e;o=t?"."+t:e&&"object"==typeof e?e.props?"":c(e,""):!1===e?"":e}return e+a+(null==o?"":o)},"");function x(e){let t=this||{},s=e.call?e(t.p):e;return p(s.unshift?s.raw?u(s,[].slice.call(arguments,1),t.p):s.reduce((e,s)=>Object.assign(e,s&&s.call?s(t.p):s),{}):s,i(t.target),t.g,t.o,t.k)}x.bind({g:1});let f,b,g,v=x.bind({k:1});function y(e,t){let s=this||{};return function(){let a=arguments;function r(o,i){let n=Object.assign({},o),l=n.className||r.className;s.p=Object.assign({theme:b&&b()},n),s.o=/ *go\d+/.test(l),n.className=x.apply(s,a)+(l?" "+l:""),t&&(n.ref=i);let d=e;return e[0]&&(d=n.as||e,delete n.as),g&&d[0]&&g(n),f(d,n)}return t?t(r):r}}var j=e=>"function"==typeof e,w=(e,t)=>j(e)?e(t):e,k=(()=>{let e=0;return()=>(++e).toString()})(),N=(()=>{let e;return()=>e})(),C="default",L=(e,t)=>{let{toastLimit:s}=e.settings;switch(t.type){case 0:return{...e,toasts:[t.toast,...e.toasts].slice(0,s)};case 1:return{...e,toasts:e.toasts.map(e=>e.id===t.toast.id?{...e,...t.toast}:e)};case 2:let{toast:a}=t;return L(e,{type:e.toasts.find(e=>e.id===a.id)?1:0,toast:a});case 3:let{toastId:r}=t;return{...e,toasts:e.toasts.map(e=>e.id===r||void 0===r?{...e,dismissed:!0,visible:!1}:e)};case 4:return void 0===t.toastId?{...e,toasts:[]}:{...e,toasts:e.toasts.filter(e=>e.id!==t.toastId)};case 5:return{...e,pausedAt:t.time};case 6:let o=t.time-(e.pausedAt||0);return{...e,pausedAt:void 0,toasts:e.toasts.map(e=>({...e,pauseDuration:e.pauseDuration+o}))}}},M=[],P={toasts:[],pausedAt:void 0,settings:{toastLimit:20}},S={},E=(e,t=C)=>{S[t]=L(S[t]||P,e),M.forEach(([e,s])=>{e===t&&s(S[t])})},z=e=>Object.keys(S).forEach(t=>E(e,t)),A=e=>Object.keys(S).find(t=>S[t].toasts.some(t=>t.id===e)),D=(e=C)=>t=>{E(t,e)},$={blank:4e3,error:4e3,success:2e3,loading:1/0,custom:4e3},B=(e={},t=C)=>{let[s,a]=(0,r.useState)(S[t]||P),o=(0,r.useRef)(S[t]);(0,r.useEffect)(()=>(o.current!==S[t]&&a(S[t]),M.push([t,a]),()=>{let e=M.findIndex(([e])=>e===t);e>-1&&M.splice(e,1)}),[t]);let i=s.toasts.map(t=>{var s,a,r;return{...e,...e[t.type],...t,removeDelay:t.removeDelay||(null==(s=e[t.type])?void 0:s.removeDelay)||(null==e?void 0:e.removeDelay),duration:t.duration||(null==(a=e[t.type])?void 0:a.duration)||(null==e?void 0:e.duration)||$[t.type],style:{...e.style,...null==(r=e[t.type])?void 0:r.style,...t.style}}});return{...s,toasts:i}},W=(e,t="blank",s)=>({createdAt:Date.now(),visible:!0,dismissed:!1,type:t,ariaProps:{role:"status","aria-live":"polite"},message:e,pauseDuration:0,...s,id:(null==s?void 0:s.id)||k()}),_=e=>(t,s)=>{let a=W(t,e,s);return D(a.toasterId||A(a.id))({type:2,toast:a}),a.id},O=(e,t)=>_("blank")(e,t);O.error=_("error"),O.success=_("success"),O.loading=_("loading"),O.custom=_("custom"),O.dismiss=(e,t)=>{let s={type:3,toastId:e};t?D(t)(s):z(s)},O.dismissAll=e=>O.dismiss(void 0,e),O.remove=(e,t)=>{let s={type:4,toastId:e};t?D(t)(s):z(s)},O.removeAll=e=>O.remove(void 0,e),O.promise=(e,t,s)=>{let a=O.loading(t.loading,{...s,...null==s?void 0:s.loading});return"function"==typeof e&&(e=e()),e.then(e=>{let r=t.success?w(t.success,e):void 0;return r?O.success(r,{id:a,...s,...null==s?void 0:s.success}):O.dismiss(a),e}).catch(e=>{let r=t.error?w(t.error,e):void 0;r?O.error(r,{id:a,...s,...null==s?void 0:s.error}):O.dismiss(a)}),e};var V=1e3,H=(e,t="default")=>{let{toasts:s,pausedAt:a}=B(e,t),o=(0,r.useRef)(new Map).current,i=(0,r.useCallback)((e,t=V)=>{if(o.has(e))return;let s=setTimeout(()=>{o.delete(e),n({type:4,toastId:e})},t);o.set(e,s)},[]);(0,r.useEffect)(()=>{if(a)return;let e=Date.now(),r=s.map(s=>{if(s.duration===1/0)return;let a=(s.duration||0)+s.pauseDuration-(e-s.createdAt);if(a<0){s.visible&&O.dismiss(s.id);return}return setTimeout(()=>O.dismiss(s.id,t),a)});return()=>{r.forEach(e=>e&&clearTimeout(e))}},[s,a,t]);let n=(0,r.useCallback)(D(t),[t]),l=(0,r.useCallback)(()=>{n({type:5,time:Date.now()})},[n]),d=(0,r.useCallback)((e,t)=>{n({type:1,toast:{id:e,height:t}})},[n]),c=(0,r.useCallback)(()=>{a&&n({type:6,time:Date.now()})},[a,n]),h=(0,r.useCallback)((e,t)=>{let{reverseOrder:a=!1,gutter:r=8,defaultPosition:o}=t||{},i=s.filter(t=>(t.position||o)===(e.position||o)&&t.height),n=i.findIndex(t=>t.id===e.id),l=i.filter((e,t)=>t<n&&e.visible).length;return i.filter(e=>e.visible).slice(...a?[l+1]:[0,l]).reduce((e,t)=>e+(t.height||0)+r,0)},[s]);return(0,r.useEffect)(()=>{s.forEach(e=>{if(e.dismissed)i(e.id,e.removeDelay);else{let t=o.get(e.id);t&&(clearTimeout(t),o.delete(e.id))}})},[s,i]),{toasts:s,handlers:{updateHeight:d,startPause:l,endPause:c,calculateOffset:h}}},I=v`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
 transform: scale(1) rotate(45deg);
  opacity: 1;
}`,T=v`
from {
  transform: scale(0);
  opacity: 0;
}
to {
  transform: scale(1);
  opacity: 1;
}`,F=v`
from {
  transform: scale(0) rotate(90deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(90deg);
	opacity: 1;
}`,R=y("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${e=>e.primary||"#ff4b4b"};
  position: relative;
  transform: rotate(45deg);

  animation: ${I} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;

  &:after,
  &:before {
    content: '';
    animation: ${T} 0.15s ease-out forwards;
    animation-delay: 150ms;
    position: absolute;
    border-radius: 3px;
    opacity: 0;
    background: ${e=>e.secondary||"#fff"};
    bottom: 9px;
    left: 4px;
    height: 2px;
    width: 12px;
  }

  &:before {
    animation: ${F} 0.15s ease-out forwards;
    animation-delay: 180ms;
    transform: rotate(90deg);
  }
`,q=v`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`,U=y("div")`
  width: 12px;
  height: 12px;
  box-sizing: border-box;
  border: 2px solid;
  border-radius: 100%;
  border-color: ${e=>e.secondary||"#e0e0e0"};
  border-right-color: ${e=>e.primary||"#616161"};
  animation: ${q} 1s linear infinite;
`,G=v`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(45deg);
	opacity: 1;
}`,J=v`
0% {
	height: 0;
	width: 0;
	opacity: 0;
}
40% {
  height: 0;
	width: 6px;
	opacity: 1;
}
100% {
  opacity: 1;
  height: 10px;
}`,Q=y("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${e=>e.primary||"#61d345"};
  position: relative;
  transform: rotate(45deg);

  animation: ${G} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;
  &:after {
    content: '';
    box-sizing: border-box;
    animation: ${J} 0.2s ease-out forwards;
    opacity: 0;
    animation-delay: 200ms;
    position: absolute;
    border-right: 2px solid;
    border-bottom: 2px solid;
    border-color: ${e=>e.secondary||"#fff"};
    bottom: 6px;
    left: 6px;
    height: 10px;
    width: 6px;
  }
`,X=y("div")`
  position: absolute;
`,Y=y("div")`
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 20px;
  min-height: 20px;
`,Z=v`
from {
  transform: scale(0.6);
  opacity: 0.4;
}
to {
  transform: scale(1);
  opacity: 1;
}`,K=y("div")`
  position: relative;
  transform: scale(0.6);
  opacity: 0.4;
  min-width: 20px;
  animation: ${Z} 0.3s 0.12s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
`,ee=({toast:e})=>{let{icon:t,type:s,iconTheme:a}=e;return void 0!==t?"string"==typeof t?r.createElement(K,null,t):t:"blank"===s?null:r.createElement(Y,null,r.createElement(U,{...a}),"loading"!==s&&r.createElement(X,null,"error"===s?r.createElement(R,{...a}):r.createElement(Q,{...a})))},et=e=>`
0% {transform: translate3d(0,${-200*e}%,0) scale(.6); opacity:.5;}
100% {transform: translate3d(0,0,0) scale(1); opacity:1;}
`,es=e=>`
0% {transform: translate3d(0,0,-1px) scale(1); opacity:1;}
100% {transform: translate3d(0,${-150*e}%,-1px) scale(.6); opacity:0;}
`,ea=y("div")`
  display: flex;
  align-items: center;
  background: #fff;
  color: #363636;
  line-height: 1.3;
  will-change: transform;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1), 0 3px 3px rgba(0, 0, 0, 0.05);
  max-width: 350px;
  pointer-events: auto;
  padding: 8px 10px;
  border-radius: 8px;
`,er=y("div")`
  display: flex;
  justify-content: center;
  margin: 4px 10px;
  color: inherit;
  flex: 1 1 auto;
  white-space: pre-line;
`,eo=(e,t)=>{let s=e.includes("top")?1:-1,[a,r]=N()?["0%{opacity:0;} 100%{opacity:1;}","0%{opacity:1;} 100%{opacity:0;}"]:[et(s),es(s)];return{animation:t?`${v(a)} 0.35s cubic-bezier(.21,1.02,.73,1) forwards`:`${v(r)} 0.4s forwards cubic-bezier(.06,.71,.55,1)`}},ei=r.memo(({toast:e,position:t,style:s,children:a})=>{let o=e.height?eo(e.position||t||"top-center",e.visible):{opacity:0},i=r.createElement(ee,{toast:e}),n=r.createElement(er,{...e.ariaProps},w(e.message,e));return r.createElement(ea,{className:e.className,style:{...o,...s,...e.style}},"function"==typeof a?a({icon:i,message:n}):r.createElement(r.Fragment,null,i,n))});a=r.createElement,c.p=void 0,f=a,b=void 0,g=void 0;var en=({id:e,className:t,style:s,onHeightUpdate:a,children:o})=>{let i=r.useCallback(t=>{if(t){let s=()=>{a(e,t.getBoundingClientRect().height)};s(),new MutationObserver(s).observe(t,{subtree:!0,childList:!0,characterData:!0})}},[e,a]);return r.createElement("div",{ref:i,className:t,style:s},o)},el=(e,t)=>{let s=e.includes("top"),a=e.includes("center")?{justifyContent:"center"}:e.includes("right")?{justifyContent:"flex-end"}:{};return{left:0,right:0,display:"flex",position:"absolute",transition:N()?void 0:"all 230ms cubic-bezier(.21,1.02,.73,1)",transform:`translateY(${t*(s?1:-1)}px)`,...s?{top:0}:{bottom:0},...a}},ed=x`
  z-index: 9999;
  > * {
    pointer-events: auto;
  }
`,ec=({reverseOrder:e,position:t="top-center",toastOptions:s,gutter:a,children:o,toasterId:i,containerStyle:n,containerClassName:l})=>{let{toasts:d,handlers:c}=H(s,i);return r.createElement("div",{"data-rht-toaster":i||"",style:{position:"fixed",zIndex:9999,top:16,left:16,right:16,bottom:16,pointerEvents:"none",...n},className:l,onMouseEnter:c.startPause,onMouseLeave:c.endPause},d.map(s=>{let i=s.position||t,n=el(i,c.calculateOffset(s,{reverseOrder:e,gutter:a,defaultPosition:t}));return r.createElement(en,{id:s.id,key:s.id,onHeightUpdate:c.updateHeight,className:s.visible?ed:"",style:n},"custom"===s.type?w(s.message,s):o?o(s):r.createElement(ei,{toast:s,position:i}))}))},eh=O}};var t=require("../../../webpack-runtime.js");t.C(e);var s=e=>t(t.s=e),a=t.X(0,[9276,4471,4496],()=>s(6109));module.exports=a})();