(()=>{var e={};e.id=305,e.ids=[305],e.modules={2934:e=>{"use strict";e.exports=require("next/dist/client/components/action-async-storage.external.js")},4580:e=>{"use strict";e.exports=require("next/dist/client/components/request-async-storage.external.js")},5869:e=>{"use strict";e.exports=require("next/dist/client/components/static-generation-async-storage.external.js")},399:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},8597:(e,t,a)=>{"use strict";a.r(t),a.d(t,{GlobalError:()=>n.a,__next_app__:()=>u,originalPathname:()=>m,pages:()=>c,routeModule:()=>p,tree:()=>d}),a(451),a(2834),a(2029),a(5866);var s=a(3191),r=a(8716),i=a(7922),n=a.n(i),o=a(5231),l={};for(let e in o)0>["default","tree","pages","GlobalError","originalPathname","__next_app__","routeModule"].indexOf(e)&&(l[e]=()=>o[e]);a.d(t,l);let d=["",{children:["dashboard",{children:["campaigns",{children:["__PAGE__",{},{page:[()=>Promise.resolve().then(a.bind(a,451)),"/Users/admin/whatsapp-saas/src/app/dashboard/campaigns/page.tsx"]}]},{}]},{layout:[()=>Promise.resolve().then(a.bind(a,2834)),"/Users/admin/whatsapp-saas/src/app/dashboard/layout.tsx"]}]},{layout:[()=>Promise.resolve().then(a.bind(a,2029)),"/Users/admin/whatsapp-saas/src/app/layout.tsx"],"not-found":[()=>Promise.resolve().then(a.t.bind(a,5866,23)),"next/dist/client/components/not-found-error"]}],c=["/Users/admin/whatsapp-saas/src/app/dashboard/campaigns/page.tsx"],m="/dashboard/campaigns/page",u={require:a,loadChunk:()=>Promise.resolve()},p=new s.AppPageRouteModule({definition:{kind:r.x.APP_PAGE,page:"/dashboard/campaigns/page",pathname:"/dashboard/campaigns",bundlePath:"",filename:"",appPaths:[]},userland:{loaderTree:d}})},2120:(e,t,a)=>{Promise.resolve().then(a.t.bind(a,2994,23)),Promise.resolve().then(a.t.bind(a,6114,23)),Promise.resolve().then(a.t.bind(a,9727,23)),Promise.resolve().then(a.t.bind(a,9671,23)),Promise.resolve().then(a.t.bind(a,1868,23)),Promise.resolve().then(a.t.bind(a,4759,23))},4522:(e,t,a)=>{Promise.resolve().then(a.bind(a,3251))},9788:(e,t,a)=>{Promise.resolve().then(a.bind(a,7022))},4827:()=>{},3251:(e,t,a)=>{"use strict";a.r(t),a.d(t,{default:()=>n});var s=a(326),r=a(7577),i=a(381);function n(){let[e,t]=(0,r.useState)([]),[a,n]=(0,r.useState)(!1),[o,l]=(0,r.useState)({name:"",content:"",scheduledAt:"",recurrence:""}),[d,c]=(0,r.useState)(!1),[m,u]=(0,r.useState)(null),[p,h]=(0,r.useState)([]);async function x(a){if(a.preventDefault(),o.name&&o.content){c(!0);try{let a=await fetch("/api/campaigns",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...o,contactIds:p})}),s=await a.json();a.ok?(t([s.campaign,...e]),n(!1),l({name:"",content:"",scheduledAt:"",recurrence:""}),i.default.success("Campaign created!")):i.default.error(s.error||"Failed")}finally{c(!1)}}}async function f(e){u(e),i.default.loading("Sending messages... this may take a while",{id:"sending"});try{let a=await fetch("/api/campaigns/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({campaignId:e})}),s=await a.json();if(i.default.dismiss("sending"),a.ok){i.default.success(`Sent: ${s.sent}/${s.total} messages delivered`);let e=await fetch("/api/campaigns").then(e=>e.json());t(e.campaigns||[])}else i.default.error(s.error||"Send failed")}catch{i.default.dismiss("sending"),i.default.error("Network error")}finally{u(null)}}let g=e=>"SENT"===e?"bg-green-100 text-green-700":"SENDING"===e?"bg-amber/10 text-amber":"SCHEDULED"===e?"bg-blue-100 text-blue-700":"bg-gray-100 text-slate-light";return(0,s.jsxs)("div",{className:"max-w-4xl space-y-6",children:[(0,s.jsxs)("div",{className:"flex items-center justify-between",children:[(0,s.jsxs)("div",{children:[s.jsx("h1",{className:"font-heading text-2xl text-slate",children:"Campaigns"}),(0,s.jsxs)("p",{className:"text-sm text-slate-light mt-0.5",children:[e.length," campaign",1!==e.length?"s":""," created"]})]}),(0,s.jsxs)("button",{onClick:()=>n(!0),className:"flex items-center gap-2 bg-amber hover:bg-amber-dark text-white text-sm font-semibold px-4 py-2.5 rounded-btn transition-colors",children:[s.jsx("svg",{className:"w-4 h-4",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:s.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M12 4v16m8-8H4"})}),"New Campaign"]})]}),0===e.length?(0,s.jsxs)("div",{className:"bg-surface rounded-card border border-gray-100 p-12 text-center",children:[s.jsx("div",{className:"text-5xl mb-4",children:"\uD83D\uDCE8"}),s.jsx("h3",{className:"font-heading text-xl text-slate mb-2",children:"No campaigns yet"}),s.jsx("p",{className:"text-slate-light mb-6 max-w-sm mx-auto",children:"Create your first campaign and start reaching your customers on WhatsApp."}),s.jsx("button",{onClick:()=>n(!0),className:"bg-amber hover:bg-amber-dark text-white font-semibold px-6 py-3 rounded-btn transition-colors",children:"Create First Campaign"})]}):s.jsx("div",{className:"bg-surface rounded-card border border-gray-100 overflow-hidden",children:(0,s.jsxs)("table",{className:"w-full",children:[s.jsx("thead",{children:(0,s.jsxs)("tr",{className:"border-b border-gray-100 bg-gray-50/50",children:[s.jsx("th",{className:"text-left px-6 py-3 text-xs font-semibold text-slate-light uppercase tracking-wider",children:"Campaign"}),s.jsx("th",{className:"text-left px-6 py-3 text-xs font-semibold text-slate-light uppercase tracking-wider",children:"Status"}),s.jsx("th",{className:"text-left px-6 py-3 text-xs font-semibold text-slate-light uppercase tracking-wider",children:"Messages"}),s.jsx("th",{className:"text-left px-6 py-3 text-xs font-semibold text-slate-light uppercase tracking-wider",children:"Created"}),s.jsx("th",{className:"px-6 py-3"})]})}),s.jsx("tbody",{className:"divide-y divide-gray-50",children:e.map(a=>(0,s.jsxs)("tr",{className:"hover:bg-gray-50/50 transition-colors",children:[(0,s.jsxs)("td",{className:"px-6 py-4",children:[s.jsx("div",{className:"font-medium text-slate text-sm",children:a.name}),s.jsx("div",{className:"text-xs text-slate-light mt-0.5 truncate max-w-xs",children:a.content})]}),s.jsx("td",{className:"px-6 py-4",children:s.jsx("span",{className:`text-xs px-2 py-1 rounded-full font-medium ${g(a.status)}`,children:a.status})}),s.jsx("td",{className:"px-6 py-4 text-sm text-slate",children:a._count?.messages||0}),s.jsx("td",{className:"px-6 py-4 text-xs text-slate-light",children:new Date(a.createdAt).toLocaleDateString()}),s.jsx("td",{className:"px-6 py-4",children:(0,s.jsxs)("div",{className:"flex items-center gap-2",children:["DRAFT"===a.status&&s.jsx("button",{onClick:()=>f(a.id),disabled:m===a.id,className:"flex items-center gap-1.5 text-sm bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-btn font-medium transition-colors disabled:opacity-60",children:m===a.id?(0,s.jsxs)(s.Fragment,{children:[s.jsx("span",{className:"w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"}),"Sending..."]}):(0,s.jsxs)(s.Fragment,{children:[s.jsx("svg",{className:"w-4 h-4",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:s.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M12 19l9 2-9-18-9 18 9-2zm0 0v-8"})}),"Send"]})}),(0,s.jsxs)("button",{onClick:async()=>{let s=await fetch(`/api/campaigns/${a.id}/duplicate`,{method:"POST"}),r=await s.json();s.ok?(t([r.campaign,...e]),i.default.success("Campaign duplicated!")):i.default.error(r.error||"Failed to duplicate")},className:"flex items-center gap-1.5 text-sm text-slate-light hover:text-slate px-2 py-1.5 rounded-btn hover:bg-gray-100 transition-colors",title:"Duplicate",children:[s.jsx("svg",{className:"w-4 h-4",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:s.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"})}),"SENT"===a.status&&s.jsx("span",{className:"text-xs text-green-600 font-medium",children:"✓ Sent"})]})]})})]},a.id))})]})}),a&&s.jsx("div",{className:"fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm",children:(0,s.jsxs)("div",{className:"bg-surface rounded-card w-full max-w-lg shadow-2xl",children:[(0,s.jsxs)("div",{className:"flex items-center justify-between px-6 py-4 border-b border-gray-100",children:[s.jsx("h3",{className:"font-heading text-xl text-slate",children:"New Campaign"}),s.jsx("button",{onClick:()=>n(!1),className:"text-slate-light hover:text-slate transition-colors",children:s.jsx("svg",{className:"w-5 h-5",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:s.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M6 18L18 6M6 6l12 12"})})})]}),(0,s.jsxs)("form",{onSubmit:x,className:"p-6 space-y-4",children:[(0,s.jsxs)("div",{children:[s.jsx("label",{className:"block text-sm font-medium text-slate mb-1.5",children:"Campaign Name *"}),s.jsx("input",{type:"text",placeholder:"e.g. Easter Promo - 20% off braids",value:o.name,onChange:e=>l({...o,name:e.target.value}),className:"w-full px-4 py-2.5 rounded-btn border border-gray-200 text-slate placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber/40",required:!0})]}),(0,s.jsxs)("div",{children:[s.jsx("label",{className:"block text-sm font-medium text-slate mb-1.5",children:"Message *"}),s.jsx("textarea",{placeholder:"Hi {{name}}! Don't forget to claim your discount today...",value:o.content,onChange:e=>l({...o,content:e.target.value}),rows:5,className:"w-full px-4 py-2.5 rounded-btn border border-gray-200 text-slate placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber/40 resize-none",required:!0}),(0,s.jsxs)("div",{className:"text-xs text-slate-light mt-1",children:["Tip: Use ","{{name}}"," for personalized messages. Unicode and emoji supported! \uD83D\uDC87‍♀️"]})]}),(0,s.jsxs)("div",{children:[s.jsx("label",{className:"block text-sm font-medium text-slate mb-1.5",children:"Schedule (optional)"}),s.jsx("input",{type:"datetime-local",value:o.scheduledAt,onChange:e=>l({...o,scheduledAt:e.target.value}),className:"w-full px-4 py-2.5 rounded-btn border border-gray-200 text-slate focus:outline-none focus:ring-2 focus:ring-amber/40"})]}),(0,s.jsxs)("div",{children:[s.jsx("label",{className:"block text-sm font-medium text-slate mb-1.5",children:"Repeat (optional)"}),(0,s.jsxs)("select",{value:o.recurrence||"",onChange:e=>l({...o,recurrence:e.target.value}),className:"w-full px-4 py-2.5 rounded-btn border border-gray-200 text-slate focus:outline-none focus:ring-2 focus:ring-amber/40",children:[s.jsx("option",{value:"",children:"Don't repeat"}),s.jsx("option",{value:"DAILY",children:"Daily"}),s.jsx("option",{value:"WEEKLY",children:"Weekly"}),s.jsx("option",{value:"MONTHLY",children:"Monthly"})]})]}),s.jsx("div",{className:"bg-amber/5 border border-amber/10 rounded-lg px-4 py-3 text-sm text-slate",children:(0,s.jsxs)("span",{className:"font-semibold",children:["\uD83D\uDCCB Ready to send to ",p.length," contacts"]})}),(0,s.jsxs)("div",{className:"flex gap-3 pt-2",children:[s.jsx("button",{type:"button",onClick:()=>n(!1),className:"flex-1 py-2.5 rounded-btn bg-gray-100 hover:bg-gray-200 text-slate font-medium transition-colors",children:"Cancel"}),(0,s.jsxs)("button",{type:"submit",disabled:d,className:"flex-1 py-2.5 rounded-btn bg-amber hover:bg-amber-dark text-white font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2",children:[d?s.jsx("span",{className:"w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"}):null,d?"Creating...":"Create Campaign"]})]})]})]})})]})}},7022:(e,t,a)=>{"use strict";a.r(t),a.d(t,{default:()=>l});var s=a(326),r=a(7577),i=a(434),n=a(5047);let o=[{label:"Dashboard",href:"/dashboard",icon:s.jsx("svg",{className:"w-5 h-5",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:s.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"})})},{label:"Drip Queue",href:"/dashboard/drip-queue",icon:s.jsx("svg",{className:"w-5 h-5",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:s.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"})})},{label:"Settings",href:"/dashboard/settings",icon:(0,s.jsxs)("svg",{className:"w-5 h-5",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:[s.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"}),s.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M15 12a3 3 0 11-6 0 3 3 0 016 0z"})]})},{label:"Forms",href:"/dashboard/forms",icon:s.jsx("svg",{className:"w-5 h-5",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:s.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"})})},{label:"Pipeline",href:"/dashboard/pipeline",icon:s.jsx("svg",{className:"w-5 h-5",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:s.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"})})},{label:"Analytics",href:"/dashboard/analytics",icon:s.jsx("svg",{className:"w-5 h-5",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:s.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"})})},{label:"Campaigns",href:"/dashboard/campaigns",icon:s.jsx("svg",{className:"w-5 h-5",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:s.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"})})},{label:"Contacts",href:"/dashboard/contacts",icon:s.jsx("svg",{className:"w-5 h-5",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:s.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"})})},{label:"Drip Queue",href:"/dashboard/drip-queue",icon:s.jsx("svg",{className:"w-5 h-5",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:s.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"})})},{label:"Connect WhatsApp",href:"/dashboard/connect",icon:s.jsx("svg",{className:"w-5 h-5",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:s.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"})})},{label:"Waitlist",href:"/dashboard/waitlist",icon:s.jsx("svg",{className:"w-5 h-5",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:s.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"})})}];function l({children:e}){let t=(0,n.usePathname)(),a=(0,n.useRouter)(),[l,d]=(0,r.useState)(!1),[c,m]=(0,r.useState)(null);async function u(){await fetch("/api/auth/logout",{method:"POST"}),a.push("/login"),a.refresh()}let p=c?.plan==="FREE"?"Free Plan":c?.plan==="STARTER"?"Starter Plan":c?.plan==="GROWTH"?"Growth Plan":c?.plan==="PRO"?"Pro Plan":"Free Plan",h=c?.name?.charAt(0).toUpperCase()||"U";return(0,s.jsxs)("div",{className:"min-h-screen bg-cream flex",children:[(0,s.jsxs)("aside",{className:`fixed inset-y-0 left-0 z-40 w-64 bg-slate text-white transform transition-transform duration-200 ${l?"translate-x-0":"-translate-x-full"} md:translate-x-0 md:static`,children:[(0,s.jsxs)("div",{className:"flex items-center gap-3 px-6 py-5 border-b border-white/10",children:[s.jsx("div",{className:"w-8 h-8 rounded-lg bg-amber flex items-center justify-center",children:(0,s.jsxs)("svg",{width:"18",height:"18",viewBox:"0 0 24 24",fill:"white",children:[s.jsx("path",{d:"M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"}),s.jsx("path",{d:"M12 0C5.373 0 0 5.373 0 12c0 2.11.547 4.11 1.497 5.84L0 24l6.335-1.663A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"})]})}),(0,s.jsxs)("div",{children:[s.jsx("div",{className:"font-heading text-lg",children:"SendFlow"}),s.jsx("div",{className:"text-xs text-gray-400",children:"Business Dashboard"})]})]}),s.jsx("nav",{className:"px-3 py-4 space-y-1",children:o.map(e=>{let a=t===e.href;return(0,s.jsxs)(i.default,{href:e.href,className:`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${a?"bg-amber text-white":"text-gray-300 hover:bg-white/10"}`,children:[e.icon,e.label]},e.href)})}),s.jsx("div",{className:"absolute bottom-0 left-0 right-0 px-4 py-4 border-t border-white/10",children:(0,s.jsxs)("div",{className:"flex items-center gap-3",children:[s.jsx("div",{className:"w-8 h-8 rounded-full bg-amber/20 flex items-center justify-center text-amber text-sm font-bold",children:h}),(0,s.jsxs)("div",{className:"flex-1 min-w-0",children:[s.jsx("div",{className:"text-sm font-medium truncate",children:c?.name||"Loading..."}),s.jsx("div",{className:"text-xs text-gray-400 truncate",children:p})]}),s.jsx("button",{onClick:u,className:"text-gray-400 hover:text-white transition-colors",title:"Sign out",children:s.jsx("svg",{className:"w-4 h-4",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:s.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"})})})]})})]}),l&&s.jsx("div",{className:"fixed inset-0 z-30 bg-black/50 md:hidden",onClick:()=>d(!1)}),(0,s.jsxs)("div",{className:"flex-1 flex flex-col min-w-0",children:[(0,s.jsxs)("header",{className:"sticky top-0 z-30 bg-cream/90 backdrop-blur-md border-b border-gray-200 px-4 md:px-8 h-16 flex items-center justify-between",children:[s.jsx("button",{className:"md:hidden p-2 -ml-2 text-slate",onClick:()=>d(!0),children:s.jsx("svg",{className:"w-6 h-6",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:s.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M4 6h16M4 12h16M4 18h16"})})}),s.jsx("div",{className:"text-sm text-slate-light hidden md:block",children:"Dashboard"}),(0,s.jsxs)("div",{className:"flex items-center gap-3",children:[s.jsx("span",{className:"text-xs bg-amber/10 text-amber px-2.5 py-1 rounded-pill font-medium",children:p}),s.jsx(i.default,{href:"/",className:"text-xs text-slate-light hover:text-slate transition-colors",children:"← Landing"})]})]}),s.jsx("main",{className:"flex-1 p-4 md:p-8",children:e})]})]})}},451:(e,t,a)=>{"use strict";a.r(t),a.d(t,{default:()=>s});let s=(0,a(8570).createProxy)(String.raw`/Users/admin/whatsapp-saas/src/app/dashboard/campaigns/page.tsx#default`)},2834:(e,t,a)=>{"use strict";a.r(t),a.d(t,{default:()=>s});let s=(0,a(8570).createProxy)(String.raw`/Users/admin/whatsapp-saas/src/app/dashboard/layout.tsx#default`)},2029:(e,t,a)=>{"use strict";a.r(t),a.d(t,{default:()=>i,metadata:()=>r});var s=a(9510);a(5023);let r={title:"SendFlow — Bulk WhatsApp Marketing for African SMBs",description:"Reach thousands of customers instantly. Reliable delivery, real-time reports. From $29/month.",keywords:"WhatsApp marketing, bulk messaging, African SMB, Ghana business, WhatsApp business"};function i({children:e}){return s.jsx("html",{lang:"en",children:s.jsx("body",{children:e})})}},5023:()=>{},381:(e,t,a)=>{"use strict";a.d(t,{Toaster:()=>ec,default:()=>em});var s,r=a(7577);let i={data:""},n=e=>{if("object"==typeof window){let t=(e?e.querySelector("#_goober"):window._goober)||Object.assign(document.createElement("style"),{innerHTML:" ",id:"_goober"});return t.nonce=window.__nonce__,t.parentNode||(e||document.head).appendChild(t),t.firstChild}return e||i},o=/(?:([\u0080-\uFFFF\w-%@]+) *:? *([^{;]+?);|([^;}{]*?) *{)|(}\s*)/g,l=/\/\*[^]*?\*\/|  +/g,d=/\n+/g,c=(e,t)=>{let a="",s="",r="";for(let i in e){let n=e[i];"@"==i[0]?"i"==i[1]?a=i+" "+n+";":s+="f"==i[1]?c(n,i):i+"{"+c(n,"k"==i[1]?"":t)+"}":"object"==typeof n?s+=c(n,t?t.replace(/([^,])+/g,e=>i.replace(/([^,]*:\S+\([^)]*\))|([^,])+/g,t=>/&/.test(t)?t.replace(/&/g,e):e?e+" "+t:t)):i):null!=n&&(i=/^--/.test(i)?i:i.replace(/[A-Z]/g,"-$&").toLowerCase(),r+=c.p?c.p(i,n):i+":"+n+";")}return a+(t&&r?t+"{"+r+"}":r)+s},m={},u=e=>{if("object"==typeof e){let t="";for(let a in e)t+=a+u(e[a]);return t}return e},p=(e,t,a,s,r)=>{let i=u(e),n=m[i]||(m[i]=(e=>{let t=0,a=11;for(;t<e.length;)a=101*a+e.charCodeAt(t++)>>>0;return"go"+a})(i));if(!m[n]){let t=i!==e?e:(e=>{let t,a,s=[{}];for(;t=o.exec(e.replace(l,""));)t[4]?s.shift():t[3]?(a=t[3].replace(d," ").trim(),s.unshift(s[0][a]=s[0][a]||{})):s[0][t[1]]=t[2].replace(d," ").trim();return s[0]})(e);m[n]=c(r?{["@keyframes "+n]:t}:t,a?"":"."+n)}let p=a&&m.g?m.g:null;return a&&(m.g=m[n]),((e,t,a,s)=>{s?t.data=t.data.replace(s,e):-1===t.data.indexOf(e)&&(t.data=a?e+t.data:t.data+e)})(m[n],t,s,p),n},h=(e,t,a)=>e.reduce((e,s,r)=>{let i=t[r];if(i&&i.call){let e=i(a),t=e&&e.props&&e.props.className||/^go/.test(e)&&e;i=t?"."+t:e&&"object"==typeof e?e.props?"":c(e,""):!1===e?"":e}return e+s+(null==i?"":i)},"");function x(e){let t=this||{},a=e.call?e(t.p):e;return p(a.unshift?a.raw?h(a,[].slice.call(arguments,1),t.p):a.reduce((e,a)=>Object.assign(e,a&&a.call?a(t.p):a),{}):a,n(t.target),t.g,t.o,t.k)}x.bind({g:1});let f,g,b,v=x.bind({k:1});function y(e,t){let a=this||{};return function(){let s=arguments;function r(i,n){let o=Object.assign({},i),l=o.className||r.className;a.p=Object.assign({theme:g&&g()},o),a.o=/ *go\d+/.test(l),o.className=x.apply(a,s)+(l?" "+l:""),t&&(o.ref=n);let d=e;return e[0]&&(d=o.as||e,delete o.as),b&&d[0]&&b(o),f(d,o)}return t?t(r):r}}var j=e=>"function"==typeof e,w=(e,t)=>j(e)?e(t):e,k=(()=>{let e=0;return()=>(++e).toString()})(),N=(()=>{let e;return()=>e})(),C="default",L=(e,t)=>{let{toastLimit:a}=e.settings;switch(t.type){case 0:return{...e,toasts:[t.toast,...e.toasts].slice(0,a)};case 1:return{...e,toasts:e.toasts.map(e=>e.id===t.toast.id?{...e,...t.toast}:e)};case 2:let{toast:s}=t;return L(e,{type:e.toasts.find(e=>e.id===s.id)?1:0,toast:s});case 3:let{toastId:r}=t;return{...e,toasts:e.toasts.map(e=>e.id===r||void 0===r?{...e,dismissed:!0,visible:!1}:e)};case 4:return void 0===t.toastId?{...e,toasts:[]}:{...e,toasts:e.toasts.filter(e=>e.id!==t.toastId)};case 5:return{...e,pausedAt:t.time};case 6:let i=t.time-(e.pausedAt||0);return{...e,pausedAt:void 0,toasts:e.toasts.map(e=>({...e,pauseDuration:e.pauseDuration+i}))}}},M=[],P={toasts:[],pausedAt:void 0,settings:{toastLimit:20}},S={},E=(e,t=C)=>{S[t]=L(S[t]||P,e),M.forEach(([e,a])=>{e===t&&a(S[t])})},D=e=>Object.keys(S).forEach(t=>E(e,t)),z=e=>Object.keys(S).find(t=>S[t].toasts.some(t=>t.id===e)),A=(e=C)=>t=>{E(t,e)},W={blank:4e3,error:4e3,success:2e3,loading:1/0,custom:4e3},$=(e={},t=C)=>{let[a,s]=(0,r.useState)(S[t]||P),i=(0,r.useRef)(S[t]);(0,r.useEffect)(()=>(i.current!==S[t]&&s(S[t]),M.push([t,s]),()=>{let e=M.findIndex(([e])=>e===t);e>-1&&M.splice(e,1)}),[t]);let n=a.toasts.map(t=>{var a,s,r;return{...e,...e[t.type],...t,removeDelay:t.removeDelay||(null==(a=e[t.type])?void 0:a.removeDelay)||(null==e?void 0:e.removeDelay),duration:t.duration||(null==(s=e[t.type])?void 0:s.duration)||(null==e?void 0:e.duration)||W[t.type],style:{...e.style,...null==(r=e[t.type])?void 0:r.style,...t.style}}});return{...a,toasts:n}},B=(e,t="blank",a)=>({createdAt:Date.now(),visible:!0,dismissed:!1,type:t,ariaProps:{role:"status","aria-live":"polite"},message:e,pauseDuration:0,...a,id:(null==a?void 0:a.id)||k()}),O=e=>(t,a)=>{let s=B(t,e,a);return A(s.toasterId||z(s.id))({type:2,toast:s}),s.id},H=(e,t)=>O("blank")(e,t);H.error=O("error"),H.success=O("success"),H.loading=O("loading"),H.custom=O("custom"),H.dismiss=(e,t)=>{let a={type:3,toastId:e};t?A(t)(a):D(a)},H.dismissAll=e=>H.dismiss(void 0,e),H.remove=(e,t)=>{let a={type:4,toastId:e};t?A(t)(a):D(a)},H.removeAll=e=>H.remove(void 0,e),H.promise=(e,t,a)=>{let s=H.loading(t.loading,{...a,...null==a?void 0:a.loading});return"function"==typeof e&&(e=e()),e.then(e=>{let r=t.success?w(t.success,e):void 0;return r?H.success(r,{id:s,...a,...null==a?void 0:a.success}):H.dismiss(s),e}).catch(e=>{let r=t.error?w(t.error,e):void 0;r?H.error(r,{id:s,...a,...null==a?void 0:a.error}):H.dismiss(s)}),e};var _=1e3,T=(e,t="default")=>{let{toasts:a,pausedAt:s}=$(e,t),i=(0,r.useRef)(new Map).current,n=(0,r.useCallback)((e,t=_)=>{if(i.has(e))return;let a=setTimeout(()=>{i.delete(e),o({type:4,toastId:e})},t);i.set(e,a)},[]);(0,r.useEffect)(()=>{if(s)return;let e=Date.now(),r=a.map(a=>{if(a.duration===1/0)return;let s=(a.duration||0)+a.pauseDuration-(e-a.createdAt);if(s<0){a.visible&&H.dismiss(a.id);return}return setTimeout(()=>H.dismiss(a.id,t),s)});return()=>{r.forEach(e=>e&&clearTimeout(e))}},[a,s,t]);let o=(0,r.useCallback)(A(t),[t]),l=(0,r.useCallback)(()=>{o({type:5,time:Date.now()})},[o]),d=(0,r.useCallback)((e,t)=>{o({type:1,toast:{id:e,height:t}})},[o]),c=(0,r.useCallback)(()=>{s&&o({type:6,time:Date.now()})},[s,o]),m=(0,r.useCallback)((e,t)=>{let{reverseOrder:s=!1,gutter:r=8,defaultPosition:i}=t||{},n=a.filter(t=>(t.position||i)===(e.position||i)&&t.height),o=n.findIndex(t=>t.id===e.id),l=n.filter((e,t)=>t<o&&e.visible).length;return n.filter(e=>e.visible).slice(...s?[l+1]:[0,l]).reduce((e,t)=>e+(t.height||0)+r,0)},[a]);return(0,r.useEffect)(()=>{a.forEach(e=>{if(e.dismissed)n(e.id,e.removeDelay);else{let t=i.get(e.id);t&&(clearTimeout(t),i.delete(e.id))}})},[a,n]),{toasts:a,handlers:{updateHeight:d,startPause:l,endPause:c,calculateOffset:m}}},F=v`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
 transform: scale(1) rotate(45deg);
  opacity: 1;
}`,R=v`
from {
  transform: scale(0);
  opacity: 0;
}
to {
  transform: scale(1);
  opacity: 1;
}`,V=v`
from {
  transform: scale(0) rotate(90deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(90deg);
	opacity: 1;
}`,I=y("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${e=>e.primary||"#ff4b4b"};
  position: relative;
  transform: rotate(45deg);

  animation: ${F} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;

  &:after,
  &:before {
    content: '';
    animation: ${R} 0.15s ease-out forwards;
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
    animation: ${V} 0.15s ease-out forwards;
    animation-delay: 180ms;
    transform: rotate(90deg);
  }
`,U=v`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`,q=y("div")`
  width: 12px;
  height: 12px;
  box-sizing: border-box;
  border: 2px solid;
  border-radius: 100%;
  border-color: ${e=>e.secondary||"#e0e0e0"};
  border-right-color: ${e=>e.primary||"#616161"};
  animation: ${U} 1s linear infinite;
`,G=v`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(45deg);
	opacity: 1;
}`,Y=v`
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
}`,J=y("div")`
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
    animation: ${Y} 0.2s ease-out forwards;
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
`,Q=y("div")`
  position: absolute;
`,K=y("div")`
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 20px;
  min-height: 20px;
`,X=v`
from {
  transform: scale(0.6);
  opacity: 0.4;
}
to {
  transform: scale(1);
  opacity: 1;
}`,Z=y("div")`
  position: relative;
  transform: scale(0.6);
  opacity: 0.4;
  min-width: 20px;
  animation: ${X} 0.3s 0.12s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
`,ee=({toast:e})=>{let{icon:t,type:a,iconTheme:s}=e;return void 0!==t?"string"==typeof t?r.createElement(Z,null,t):t:"blank"===a?null:r.createElement(K,null,r.createElement(q,{...s}),"loading"!==a&&r.createElement(Q,null,"error"===a?r.createElement(I,{...s}):r.createElement(J,{...s})))},et=e=>`
0% {transform: translate3d(0,${-200*e}%,0) scale(.6); opacity:.5;}
100% {transform: translate3d(0,0,0) scale(1); opacity:1;}
`,ea=e=>`
0% {transform: translate3d(0,0,-1px) scale(1); opacity:1;}
100% {transform: translate3d(0,${-150*e}%,-1px) scale(.6); opacity:0;}
`,es=y("div")`
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
`,ei=(e,t)=>{let a=e.includes("top")?1:-1,[s,r]=N()?["0%{opacity:0;} 100%{opacity:1;}","0%{opacity:1;} 100%{opacity:0;}"]:[et(a),ea(a)];return{animation:t?`${v(s)} 0.35s cubic-bezier(.21,1.02,.73,1) forwards`:`${v(r)} 0.4s forwards cubic-bezier(.06,.71,.55,1)`}},en=r.memo(({toast:e,position:t,style:a,children:s})=>{let i=e.height?ei(e.position||t||"top-center",e.visible):{opacity:0},n=r.createElement(ee,{toast:e}),o=r.createElement(er,{...e.ariaProps},w(e.message,e));return r.createElement(es,{className:e.className,style:{...i,...a,...e.style}},"function"==typeof s?s({icon:n,message:o}):r.createElement(r.Fragment,null,n,o))});s=r.createElement,c.p=void 0,f=s,g=void 0,b=void 0;var eo=({id:e,className:t,style:a,onHeightUpdate:s,children:i})=>{let n=r.useCallback(t=>{if(t){let a=()=>{s(e,t.getBoundingClientRect().height)};a(),new MutationObserver(a).observe(t,{subtree:!0,childList:!0,characterData:!0})}},[e,s]);return r.createElement("div",{ref:n,className:t,style:a},i)},el=(e,t)=>{let a=e.includes("top"),s=e.includes("center")?{justifyContent:"center"}:e.includes("right")?{justifyContent:"flex-end"}:{};return{left:0,right:0,display:"flex",position:"absolute",transition:N()?void 0:"all 230ms cubic-bezier(.21,1.02,.73,1)",transform:`translateY(${t*(a?1:-1)}px)`,...a?{top:0}:{bottom:0},...s}},ed=x`
  z-index: 9999;
  > * {
    pointer-events: auto;
  }
`,ec=({reverseOrder:e,position:t="top-center",toastOptions:a,gutter:s,children:i,toasterId:n,containerStyle:o,containerClassName:l})=>{let{toasts:d,handlers:c}=T(a,n);return r.createElement("div",{"data-rht-toaster":n||"",style:{position:"fixed",zIndex:9999,top:16,left:16,right:16,bottom:16,pointerEvents:"none",...o},className:l,onMouseEnter:c.startPause,onMouseLeave:c.endPause},d.map(a=>{let n=a.position||t,o=el(n,c.calculateOffset(a,{reverseOrder:e,gutter:s,defaultPosition:t}));return r.createElement(eo,{id:a.id,key:a.id,onHeightUpdate:c.updateHeight,className:a.visible?ed:"",style:o},"custom"===a.type?w(a.message,a):i?i(a):r.createElement(en,{toast:a,position:n}))}))},em=H}};var t=require("../../../webpack-runtime.js");t.C(e);var a=e=>t(t.s=e),s=t.X(0,[9276,4471,4496],()=>a(8597));module.exports=s})();