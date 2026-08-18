// Temporary: builds sidebar-preview.html (self-contained) for visual verification.
import { readFileSync, writeFileSync } from "node:fs";

const metronicCss = readFileSync("public/assets/css/styles.css", "utf8");
const appCss = readFileSync("dist/assets/index-DnqlpVU3.css", "utf8");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Sidebar preview harness</title>
<style>${metronicCss}</style>
<style>${appCss}</style>
<style>
  html, body { margin: 0; height: 100%; }
  body { display: flex; flex-direction: column; background: #fafafa; }
  #toolbar { display: flex; gap: 10px; padding: 10px 14px; font: 13px system-ui; align-items: center; }
  #toolbar button { padding: 6px 12px; border: 1px solid #ccc; border-radius: 6px; background: #fff; cursor: pointer; }
  #toolbar button:hover { background: #eee; }
  #shell { flex: 1; min-height: 0; }
  .note { color: #555; }
  svg.sq { width: 18px; height: 18px; }
</style>
</head>
<body>
  <div id="toolbar">
    <button id="btn-dark">Toggle dark mode</button>
    <button id="btn-collapse">Toggle sidebar collapse</button>
    <span class="note">Hover menu items (text/icons turn blue) — hover the sidebar to reveal the thin scrollbar.</span>
  </div>
  <div id="shell"></div>

<script>
  const GROUPS = [
    { section: null, type: "item", label: "Dashboard", icon: "dashboard", active: true },
    { section: "Academics", type: "group", label: "Academics", open: true, items: [
      "Students","Teachers","Classes","Subjects","Timetable","Online Learning","Grade Scales","Lesson Notes","Achievements","Programs","Performance Dashboard"
    ]},
    { type: "group", label: "Examinations & Results", items: ["Report Cards","Report Archive","Reports","Report Settings"] },
    { type: "group", label: "Attendance", items: ["Class Registers","Student Attendance"] },
    { type: "item", label: "Library Management" },
    { section: "Operations", type: "group", label: "Financial Management", items: ["Fees","Invoices","Payments","Payment gateways","Paid Students","Outstanding","Billing Reports","Family Billing","Billing Overview","Expenses","Other Income","Budget Management"] },
    { type: "group", label: "HR Modules", items: ["Staff Directory","Payroll","Leave Management","Staff Attendance"] },
    { type: "group", label: "Domestics", items: ["Behavior Reports","Exeats"] },
    { type: "item", label: "Student Health" },
    { type: "group", label: "Resources", items: ["School Shop","Laboratory"] },
    { type: "item", label: "Transport" },
    { type: "item", label: "Hostel" },
    { type: "item", label: "Inventory" },
    { section: "Administration", type: "group", label: "Registration & Linking", items: ["Number Generator","Pending Approvals","Parent–Student Link","Teacher–Class Link","Parent Contacts"] },
    { type: "group", label: "Communication", items: ["Announcements","EduManage AI","AI Receptionist"] },
    { type: "group", label: "Administration", items: ["Staff","Departments","Academic Calendar","School Settings","Permission Management","Approvals","Audit Logs","Subscription","Account Settings"] },
  ];

  const icon = () =>
    '<svg class="sq" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/></svg>';

  const itemMarkup = (label, active) => \`
    <div class="kt-menu-item\${active ? " active" : ""}">
      <a class="kt-menu-link border border-transparent items-center grow kt-menu-item-active:bg-accent/60 dark:menu-item-active:border-border kt-menu-item-active:rounded-lg hover:bg-accent/60 hover:rounded-lg gap-[10px] ps-[10px] pe-[10px] py-[7px] transition-colors" href="#">
        <span class="kt-menu-icon items-start text-muted-foreground w-[20px] kt-menu-link-hover:!text-primary">\${icon()}</span>
        <span class="kt-menu-title text-sm font-medium text-foreground kt-menu-item-active:text-primary kt-menu-link-hover:!text-primary">\${label}</span>
      </a>
    </div>\`;

  const groupMarkup = (label, items, open) => \`
    <div class="kt-menu-item\${open ? " show here" : ""}">
      <div class="kt-menu-link flex items-center grow cursor-pointer border border-transparent rounded-lg hover:bg-accent/60 gap-[10px] ps-[10px] pe-[10px] py-[6px] transition-colors" role="button" tabindex="0">
        <span class="kt-menu-icon items-start text-muted-foreground w-[20px] kt-menu-link-hover:!text-primary">\${icon()}</span>
        <span class="kt-menu-title text-sm font-medium text-foreground kt-menu-item-active:text-primary kt-menu-link-hover:!text-primary">\${label}</span>
        <span class="kt-menu-arrow text-muted-foreground w-[20px] shrink-0 justify-end ms-1 me-[-10px] kt-menu-link-hover:!text-primary">
          <span class="\${open ? "hidden" : "inline-flex"}">+</span>
          <span class="\${open ? "inline-flex" : "hidden"}">−</span>
        </span>
      </div>
      <div class="kt-menu-accordion gap-1 ps-[10px] relative before:absolute before:start-[20px] before:top-0 before:bottom-0 before:border-s before:border-border">
        \${items.map((sub) => \`
          <div class="kt-menu-item">
            <a class="kt-menu-link border border-transparent items-center grow kt-menu-item-active:bg-accent/60 dark:menu-item-active:border-border kt-menu-item-active:rounded-lg hover:bg-accent/60 hover:rounded-lg gap-[14px] ps-[10px] pe-[10px] py-[8px]" href="#">
              <span class="kt-menu-bullet flex w-[6px] -start-[3px] rtl:start-0 relative before:absolute before:-top-[3px] before:size-[6px] before:rounded-full"></span>
              <span class="kt-menu-title text-2sm font-normal text-foreground kt-menu-item-active:text-primary kt-menu-item-active:font-semibold kt-menu-link-hover:!text-primary">\${sub}</span>
            </a>
          </div>\`).join("")}
      </div>
    </div>\`;

  const sectionHeading = (s) => \`
    <div class="kt-menu-item pt-2.25 pb-px">
      <span class="kt-menu-heading uppercase text-xs font-medium text-muted-foreground ps-[10px] pe-[10px]">\${s}</span>
    </div>\`;

  function render() {
    let menu = "";
    for (const g of GROUPS) {
      if (g.section) menu += sectionHeading(g.section);
      menu += g.type === "item" ? itemMarkup(g.label, g.active) : groupMarkup(g.label, g.items, g.open);
    }
    document.getElementById("shell").innerHTML = \`
      <div class="demo1 kt-sidebar-fixed kt-header-fixed relative flex h-screen w-full overflow-hidden bg-background text-base text-foreground antialiased" data-portal-layout data-portal-role="admin">
        <div class="kt-sidebar dark fixed top-0 bottom-0 start-0 z-20 flex flex-col items-stretch shrink-0 bg-background border-e border-e-border transition-all duration-300" id="sidebar">
          <div class="kt-sidebar-header flex items-center relative justify-between px-3 lg:px-6 shrink-0" id="sidebar_header">
            <a class="flex items-center gap-2.5" href="#">
              <span class="default-logo flex items-center gap-2">
                <span class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">E</span>
                <span class="text-base font-semibold leading-none text-foreground">EduManage</span>
              </span>
            </a>
          </div>
          <div class="kt-sidebar-content kt-sidebar-scroll flex flex-col grow overflow-y-auto overflow-x-hidden py-5 pe-2" id="sidebar_content">
            <div class="grow flex flex-col ps-2 lg:ps-5 pe-1 lg:pe-3">
              <div class="flex w-full grow flex-col gap-3">
                <div class="kt-menu flex flex-col grow gap-1">\${menu}</div>
              </div>
            </div>
          </div>
        </div>
      </div>\`;
  }

  render();
  document.getElementById("btn-dark").addEventListener("click", () => {
    document.documentElement.classList.toggle("dark");
  });
  document.getElementById("btn-collapse").addEventListener("click", () => {
    document.getElementById("shell").querySelector(".demo1").classList.toggle("kt-sidebar-collapse");
  });
</script>
</body>
</html>
`;

writeFileSync("sidebar-preview.html", html);
console.log("wrote sidebar-preview.html", (html.length / 1024).toFixed(0) + "KB");
