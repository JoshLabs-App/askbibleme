"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";
type Size = "system" | "standard" | "large" | "extra";
const choices: Size[] = ["system","standard","large","extra"];
const Context = createContext<{size:Size;setSize:(value:Size)=>void}>({size:"system",setSize:()=>{}});
export function AppTextSizeProvider({children}:{children:ReactNode}) {
  const [size,setSize] = useState<Size>("system");
  useEffect(()=>{try {const stored=localStorage.getItem("askbible-app-text-size");if(choices.includes(stored as Size))setSize(stored as Size);}catch{}},[]);
  useEffect(()=>{
    const root=document.documentElement;const oldSize=root.style.fontSize;
    const scale=size==="large"?1.3:size==="extra"?1.6:1;
    root.style.setProperty("--app-text-scale",String(scale));
    root.style.fontSize=size==="system"?"":`${scale*100}%`;
    root.dataset.appTextSize=size;
    return ()=>{root.style.fontSize=oldSize;root.style.removeProperty("--app-text-scale");delete root.dataset.appTextSize;};
  },[size]);
  const select=(value:Size)=>{setSize(value);try{localStorage.setItem("askbible-app-text-size",value);}catch{}};
  return <Context.Provider value={{size,setSize:select}}>{children}</Context.Provider>;
}
export function AppTextSizePicker(){
  const {size,setSize}=useContext(Context);const {locale}=useLocale();
  const t=(zh:string,en:string)=>locale==="en"?en:locale==="zh-TW"?toZhTwText(zh):zh;
  const labels=[t("跟随系统","Follow system"),t("标准","Standard"),t("大","Large"),t("特大","Extra large")];
  return <fieldset className="shell-nav-drawer-locale-row"><legend className="shell-nav-drawer-row-text">{t("全局字号","App text size")}</legend><div className="flex flex-wrap gap-2">{choices.map((value,i)=><button type="button" className="shell-nav-drawer-locale-chip min-h-11 whitespace-normal" key={value} aria-pressed={size===value} onClick={()=>setSize(value)}>{labels[i]}</button>)}</div><p className="mt-3 text-base">{t("预览：你的话是我脚前的灯。","Preview: Your word is a lamp to my feet.")}</p></fieldset>;
}
