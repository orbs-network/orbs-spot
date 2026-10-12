"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import styles from "./activity-list.module.css";

export function OrderSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <div className={styles.search} data-order-search>
    <SearchIcon aria-hidden="true" />
    <Input type="search" className="h-11 rounded-[14px] pl-10 pr-11 text-xs md:text-xs" value={value} onChange={event => onChange(event.target.value)} placeholder="Search" aria-label="Search orders by token symbol or address" title="Search by token symbol or address" autoComplete="off" spellCheck={false} />
    {value && <button data-icon-button type="button" aria-label="Clear order search" onClick={() => onChange("")}><XIcon aria-hidden="true" /></button>}
  </div>;
}
