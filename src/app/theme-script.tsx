import { DEFAULT_MODE, DEFAULT_PALETTE } from "@/lib/themes";

export function ThemeScript() {
  const script = `(function(){try{var lp="labflow-palette",lm="labflow-mode",lt="labflow-theme";var leg={dark:["indigo","dark"],light:["indigo","light"],ocean:["ocean","dark"],forest:["forest","dark"],sunset:["sunset","dark"],rose:["rose","dark"]};var p=localStorage.getItem(lp),m=localStorage.getItem(lm);if(!p||!m){var old=localStorage.getItem(lt);if(old&&leg[old]){p=leg[old][0];m=leg[old][1];}else{p=p||"${DEFAULT_PALETTE}";m=m||"${DEFAULT_MODE}";}}document.documentElement.setAttribute("data-palette",p);document.documentElement.setAttribute("data-mode",m);}catch(e){document.documentElement.setAttribute("data-palette","${DEFAULT_PALETTE}");document.documentElement.setAttribute("data-mode","${DEFAULT_MODE}");}})();`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
